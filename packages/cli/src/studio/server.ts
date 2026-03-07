import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  compile,
  loadConfig,
  emitManifest,
  LintEngine,
  ALL_RULES,
  applyYamlEdit,
  previewYamlEdit,
  type Manifest,
  type Diagnostic,
} from '@runcontext/core';
import { SSEManager } from './sse.js';

export interface StudioServerOptions {
  contextDir: string;
  rootDir: string;
  port: number;
  host: string;
}

export async function startStudioServer(opts: StudioServerOptions): Promise<{
  server: http.Server;
  sse: SSEManager;
  recompileAndBroadcast: () => Promise<void>;
}> {
  const { contextDir, rootDir, port, host } = opts;
  const config = loadConfig(rootDir);
  const sse = new SSEManager();

  // Resolve Astro project directory
  const { getAstroProjectDir } = await import('@runcontext/site');
  const astroDir = getAstroProjectDir();
  const astroDataDir = path.join(astroDir, 'src', 'data');

  let cachedManifest: Manifest | null = null;

  // Write manifest data to Astro's data directory so Astro pages can import it
  async function writeAstroData(manifest: Manifest): Promise<void> {
    fs.mkdirSync(astroDataDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(astroDataDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );
    await fs.promises.writeFile(
      path.join(astroDataDir, 'site-config.json'),
      JSON.stringify({
        title: config.site?.title ?? 'ContextKit',
        studioMode: true,
      }),
      'utf-8',
    );

    // Also write search index to public dir
    const { buildSearchIndex } = await import('@runcontext/site');
    const searchIndex = buildSearchIndex(manifest, '');
    const publicDir = path.join(astroDir, 'public');
    fs.mkdirSync(publicDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(publicDir, 'search-index.json'),
      JSON.stringify(searchIndex, null, 2),
      'utf-8',
    );
  }

  async function recompile(): Promise<{ manifest: Manifest; diagnostics: Diagnostic[] }> {
    const { graph, diagnostics: compileDiags } = await compile({ contextDir, config, rootDir });
    const engine = new LintEngine();
    for (const rule of ALL_RULES) engine.register(rule);
    const lintDiags = engine.run(graph);
    const manifest = emitManifest(graph, config);
    cachedManifest = manifest;

    // Write data for Astro to consume
    await writeAstroData(manifest);

    return { manifest, diagnostics: [...compileDiags, ...lintDiags] };
  }

  async function recompileAndBroadcast(): Promise<void> {
    const { manifest, diagnostics } = await recompile();
    sse.broadcast('update', {
      tiers: manifest.tiers,
      diagnosticCount: diagnostics.length,
      diagnostics: diagnostics.slice(0, 50),
    });
  }

  // Initial compile — writes manifest to Astro data dir
  await recompile();

  // Start Astro dev server on an internal port
  const astroPort = port + 1;
  const { execFile } = await import('node:child_process');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const astroProc = execFile(
    npx,
    ['astro', 'dev', '--port', String(astroPort), '--host', host],
    { cwd: astroDir },
  );
  astroProc.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString();
    // Suppress noisy astro startup logs unless it's an error
    if (msg.includes('Error') || msg.includes('error')) {
      process.stderr.write(msg);
    }
  });

  // Wait for Astro dev server to be ready
  await new Promise<void>((resolve) => {
    let resolved = false;
    const checkInterval = setInterval(async () => {
      try {
        const testReq = http.request(
          { hostname: host === '0.0.0.0' ? '127.0.0.1' : host, port: astroPort, path: '/', method: 'HEAD', timeout: 500 },
          (res) => {
            res.resume();
            if (!resolved) {
              resolved = true;
              clearInterval(checkInterval);
              resolve();
            }
          },
        );
        testReq.on('error', () => {}); // ignore connection errors during startup
        testReq.end();
      } catch {
        // Not ready yet
      }
    }, 300);
    // Timeout after 15 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearInterval(checkInterval);
        resolve();
      }
    }, 15_000);
  });

  function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    const MAX_BODY = 1_048_576; // 1 MB
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
        if (body.length > MAX_BODY) {
          reject(new Error('Payload too large'));
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  // Proxy a request to the Astro dev server
  function proxyToAstro(req: http.IncomingMessage, res: http.ServerResponse): void {
    const proxyReq = http.request(
      {
        hostname: host === '0.0.0.0' ? '127.0.0.1' : host,
        port: astroPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Astro dev server unavailable');
    });
    req.pipe(proxyReq);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // --- API routes (handled locally) ---
      if (url.pathname === '/api/events' && req.method === 'GET') {
        sse.addClient(res);
        return;
      }

      if (url.pathname === '/api/manifest' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cachedManifest));
        return;
      }

      if (url.pathname === '/api/preview' && req.method === 'POST') {
        const body = await parseBody(req);
        const file = body.file;
        const dotPath = body.path;
        const value = body.value;
        if (typeof file !== 'string' || typeof dotPath !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: file, path' }));
          return;
        }
        const filePath = path.resolve(rootDir, file);
        const resolvedRoot = path.resolve(rootDir);
        if (!filePath.startsWith(resolvedRoot + path.sep) && filePath !== resolvedRoot) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const preview = previewYamlEdit(content, dotPath, value);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ filename: file, ...preview }));
        return;
      }

      if (url.pathname === '/api/rename-model' && req.method === 'POST') {
        const body = await parseBody(req);
        const oldName = body.oldName;
        const newName = body.newName;
        if (typeof oldName !== 'string' || typeof newName !== 'string' || !newName.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: oldName, newName' }));
          return;
        }
        const safeName = newName.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
        const resolvedCtx = path.resolve(contextDir);
        const renamed: string[] = [];

        // Rename model OSI file
        const osiOld = path.join(resolvedCtx, 'models', `${oldName}.osi.yaml`);
        const osiNew = path.join(resolvedCtx, 'models', `${safeName}.osi.yaml`);
        if (fs.existsSync(osiOld)) {
          let content = await fs.promises.readFile(osiOld, 'utf-8');
          content = content.replace(
            new RegExp(`(name:\\s*["']?)${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["']?)`, 'g'),
            `$1${safeName}$2`,
          );
          await fs.promises.writeFile(osiOld, content, 'utf-8');
          await fs.promises.rename(osiOld, osiNew);
          renamed.push(`models/${safeName}.osi.yaml`);
        }

        // Rename governance file
        const govOld = path.join(resolvedCtx, 'governance', `${oldName}.governance.yaml`);
        const govNew = path.join(resolvedCtx, 'governance', `${safeName}.governance.yaml`);
        if (fs.existsSync(govOld)) {
          let content = await fs.promises.readFile(govOld, 'utf-8');
          content = content.replace(/^model:\s*.*$/m, `model: ${safeName}`);
          await fs.promises.writeFile(govOld, content, 'utf-8');
          await fs.promises.rename(govOld, govNew);
          renamed.push(`governance/${safeName}.governance.yaml`);
        }

        // Rename rules file
        const rulesOld = path.join(resolvedCtx, 'rules', `${oldName}.rules.yaml`);
        const rulesNew = path.join(resolvedCtx, 'rules', `${safeName}.rules.yaml`);
        if (fs.existsSync(rulesOld)) {
          let content = await fs.promises.readFile(rulesOld, 'utf-8');
          content = content.replace(/^model:\s*.*$/m, `model: ${safeName}`);
          await fs.promises.writeFile(rulesOld, content, 'utf-8');
          await fs.promises.rename(rulesOld, rulesNew);
          renamed.push(`rules/${safeName}.rules.yaml`);
        }

        // Rename lineage file
        const linOld = path.join(resolvedCtx, 'lineage', `${oldName}.lineage.yaml`);
        const linNew = path.join(resolvedCtx, 'lineage', `${safeName}.lineage.yaml`);
        if (fs.existsSync(linOld)) {
          let content = await fs.promises.readFile(linOld, 'utf-8');
          content = content.replace(/^model:\s*.*$/m, `model: ${safeName}`);
          await fs.promises.writeFile(linOld, content, 'utf-8');
          await fs.promises.rename(linOld, linNew);
          renamed.push(`lineage/${safeName}.lineage.yaml`);
        }

        // Recompile after rename
        await recompileAndBroadcast();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, newName: safeName, renamed }));
        return;
      }

      if (url.pathname === '/api/save' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!Array.isArray(body.edits)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required field: edits (array)' }));
          return;
        }
        const edits = body.edits as Array<{ file: string; path: string; value: unknown }>;
        const resolvedRoot = path.resolve(rootDir);
        const results: Array<{ file: string; ok: boolean }> = [];
        for (const edit of edits) {
          const filePath = path.resolve(rootDir, edit.file);
          if (!filePath.startsWith(resolvedRoot + path.sep) && filePath !== resolvedRoot) {
            results.push({ file: edit.file, ok: false });
            continue;
          }
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const updated = applyYamlEdit(content, edit.path, edit.value);
          await fs.promises.writeFile(filePath, updated, 'utf-8');
          results.push({ file: edit.file, ok: true });
        }
        // Recompile after save so Astro picks up changes
        await recompileAndBroadcast();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results }));
        return;
      }

      // --- All other requests: proxy to Astro dev server ---
      proxyToAstro(req, res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });

  server.listen(port, host);

  // Clean up Astro process on server close
  server.on('close', () => {
    astroProc.kill();
  });

  return { server, sse, recompileAndBroadcast };
}
