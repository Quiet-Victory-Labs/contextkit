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

  let cachedPages: Map<string, string> | null = null;
  let cachedManifest: Manifest | null = null;

  async function recompile(): Promise<{ manifest: Manifest; diagnostics: Diagnostic[] }> {
    const { graph, diagnostics: compileDiags } = await compile({ contextDir, config, rootDir });
    const engine = new LintEngine();
    for (const rule of ALL_RULES) engine.register(rule);
    const lintDiags = engine.run(graph);
    const manifest = emitManifest(graph, config);
    cachedManifest = manifest;
    cachedPages = null; // invalidate
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

  async function getPages(): Promise<Map<string, string>> {
    if (cachedPages) return cachedPages;
    if (!cachedManifest) await recompile();
    const { generateSite } = await import('@runcontext/site');
    cachedPages = generateSite(cachedManifest!, config.site, { studioMode: true });
    return cachedPages;
  }

  // Initial compile
  await recompile();

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
      // --- API routes ---
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
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing required fields: file, path');
          return;
        }
        const filePath = path.resolve(rootDir, file);
        const resolvedRoot = path.resolve(rootDir);
        if (!filePath.startsWith(resolvedRoot + path.sep) && filePath !== resolvedRoot) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const preview = previewYamlEdit(content, dotPath, value);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ filename: file, ...preview }));
        return;
      }

      if (url.pathname === '/api/save' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!Array.isArray(body.edits)) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing required field: edits (array)');
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
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results }));
        return;
      }

      // --- Static site pages ---
      const pages = await getPages();
      let pagePath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
      if (!pagePath.endsWith('.html') && !pagePath.endsWith('.json')) {
        // Try exact path + .html, then directory index
        if (pages.has(pagePath + '.html')) {
          pagePath += '.html';
        } else {
          pagePath = pagePath.replace(/\/$/, '') + '/index.html';
        }
      }
      // Redirect bare /models to /models/ index (or first model)
      let page = pages.get(pagePath);
      if (!page && pagePath.endsWith('/index.html')) {
        // No index page for this directory — redirect to site root
        res.writeHead(302, { Location: '/' });
        res.end();
        return;
      }
      if (page) {
        const ct = pagePath.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8';
        res.writeHead(200, { 'Content-Type': ct });
        res.end(page);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end((err as Error).message);
    }
  });

  server.listen(port, host);

  return { server, sse, recompileAndBroadcast };
}
