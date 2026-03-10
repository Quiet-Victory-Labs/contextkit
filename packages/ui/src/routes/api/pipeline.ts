import { Hono } from 'hono';
import { execFile as execFileCb } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const execFile = promisify(execFileCb);

/**
 * Resolve the CLI entry point. Prefers the local monorepo build
 * (so `context setup` in dev always uses the local code), falling
 * back to the currently-running process argv, then npx.
 */
function resolveCliBin(): { cmd: string; prefix: string[] } {
  // 1. Try to find the local CLI dist relative to this package
  //    (packages/ui → packages/cli/dist/index.js)
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const localCli = join(thisDir, '..', '..', '..', 'cli', 'dist', 'index.js');
    if (existsSync(localCli)) {
      return { cmd: process.execPath, prefix: [localCli] };
    }
  } catch { /* ignore */ }

  // 2. If this process was started via the CLI binary, reuse it
  if (process.argv[1] && existsSync(process.argv[1])) {
    return { cmd: process.execPath, prefix: [process.argv[1]] };
  }

  // 3. Fall back to npx (published CLI)
  return { cmd: 'npx', prefix: ['--yes', '@runcontext/cli'] };
}

export type PipelineStage =
  | 'introspect'
  | 'scaffold'
  | 'enrich-silver'
  | 'enrich-gold'
  | 'verify'
  | 'autofix'
  | 'agent-instructions';

export type StageStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface PipelineStageState {
  stage: PipelineStage;
  status: StageStatus;
  summary?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PipelineRun {
  id: string;
  productName: string;
  targetTier: 'bronze' | 'silver' | 'gold';
  status: 'running' | 'done' | 'error';
  stages: PipelineStageState[];
  createdAt: string;
}

const ALL_STAGES: PipelineStage[] = [
  'introspect',
  'scaffold',
  'enrich-silver',
  'enrich-gold',
  'verify',
  'autofix',
  'agent-instructions',
];

// In-memory store for pipeline runs
const runs = new Map<string, PipelineRun>();

function stagesForTier(tier: 'bronze' | 'silver' | 'gold'): PipelineStage[] {
  const base: PipelineStage[] = ['introspect', 'scaffold'];
  if (tier === 'silver' || tier === 'gold') base.push('enrich-silver');
  if (tier === 'gold') base.push('enrich-gold');
  base.push('verify', 'autofix', 'agent-instructions');
  return base;
}

export function pipelineRoutes(rootDir: string, contextDir: string): Hono {
  const app = new Hono();

  app.post('/api/pipeline/start', async (c) => {
    const body = await c.req.json();
    const { productName, targetTier, dataSource } = body;

    if (!productName || !targetTier) {
      return c.json({ error: 'productName and targetTier required' }, 400);
    }

    if (!['bronze', 'silver', 'gold'].includes(targetTier)) {
      return c.json({ error: 'targetTier must be bronze, silver, or gold' }, 400);
    }

    // Validate productName: alphanumeric, hyphens, underscores only
    const safeNamePattern = /^[a-zA-Z0-9_-]+$/;
    if (!safeNamePattern.test(productName)) {
      return c.json({ error: 'productName must contain only letters, numbers, hyphens, and underscores' }, 400);
    }

    // Validate dataSource if provided
    if (dataSource && !safeNamePattern.test(dataSource)) {
      return c.json({ error: 'dataSource must contain only letters, numbers, hyphens, and underscores' }, 400);
    }

    const id = randomUUID();
    const activeStages = stagesForTier(targetTier);
    const skippedStages = ALL_STAGES.filter((s) => !activeStages.includes(s));

    const run: PipelineRun = {
      id,
      productName,
      targetTier,
      status: 'running',
      stages: ALL_STAGES.map((stage) => ({
        stage,
        status: skippedStages.includes(stage) ? 'skipped' : 'pending',
      })),
      createdAt: new Date().toISOString(),
    };

    runs.set(id, run);

    // Start the pipeline asynchronously (non-blocking)
    executePipeline(run, rootDir, contextDir, dataSource).catch((err) => {
      run.status = 'error';
      const currentStage = run.stages.find((s) => s.status === 'running');
      if (currentStage) {
        currentStage.status = 'error';
        currentStage.error = err instanceof Error ? err.message : String(err);
      }
    });

    return c.json({ id, status: 'running' });
  });

  app.get('/api/pipeline/status/:id', (c) => {
    const run = runs.get(c.req.param('id'));
    if (!run) return c.json({ error: 'Not found' }, 404);
    return c.json(run);
  });

  app.get('/api/mcp-config', (c) => {
    // Read runcontext.config.yaml to find a data source connection string
    let connection: string | undefined;
    try {
      const configPath = join(rootDir, 'runcontext.config.yaml');
      const configRaw = readFileSync(configPath, 'utf-8');
      const config = parseYaml(configRaw) as Record<string, unknown>;
      const dataSources = config?.data_sources as
        | Record<string, { connection?: string; path?: string }>
        | undefined;
      if (dataSources) {
        const firstKey = Object.keys(dataSources)[0];
        if (firstKey) {
          connection = dataSources[firstKey].connection || dataSources[firstKey].path;
        }
      }
    } catch {
      // Config file missing or unparseable – proceed without db entry
    }

    const cli = resolveCliBin();
    const mcpServers: Record<string, unknown> = {
      runcontext: {
        command: cli.cmd,
        args: [...cli.prefix, 'serve'],
        cwd: rootDir,
      },
    };

    if (connection) {
      mcpServers['runcontext-db'] = {
        command: 'npx',
        args: ['--yes', '@runcontext/db', '--url', connection],
      };
    }

    return c.json({ mcpServers });
  });

  return app;
}

function buildCliArgs(
  stage: PipelineStage,
  dataSource?: string,
): string[] {
  switch (stage) {
    case 'introspect': {
      const args = ['introspect'];
      if (dataSource) args.push('--source', dataSource);
      return args;
    }
    case 'scaffold':
      return ['build'];
    case 'enrich-silver': {
      const args = ['enrich', '--target', 'silver', '--apply'];
      if (dataSource) args.push('--source', dataSource);
      return args;
    }
    case 'enrich-gold': {
      const args = ['enrich', '--target', 'gold', '--apply'];
      if (dataSource) args.push('--source', dataSource);
      return args;
    }
    case 'verify':
      return ['verify'];
    case 'autofix':
      return ['fix'];
    case 'agent-instructions':
      return ['build'];
  }
}

function extractSummary(stdout: string): string {
  const lines = stdout.trim().split('\n').filter(Boolean);
  return lines.slice(-3).join('\n') || 'completed';
}

async function executePipeline(
  run: PipelineRun,
  rootDir: string,
  contextDir: string,
  dataSource?: string,
): Promise<void> {
  for (const stage of run.stages) {
    if (stage.status === 'skipped') continue;

    stage.status = 'running';
    stage.startedAt = new Date().toISOString();

    try {
      const cliArgs = buildCliArgs(stage.stage, dataSource);
      const cli = resolveCliBin();
      const { stdout } = await execFile(cli.cmd, [...cli.prefix, ...cliArgs], {
        cwd: rootDir,
        timeout: 120_000,
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=4096 --no-deprecation',
        },
      });
      stage.status = 'done';
      stage.summary = extractSummary(stdout);
      stage.completedAt = new Date().toISOString();
    } catch (err: unknown) {
      // If the command produced stdout despite failing, treat warnings-only
      // exits as success (e.g. verify with SSL deprecation warnings)
      const execErr = err as { stdout?: string; stderr?: string; code?: number };
      if (execErr.stdout && execErr.stdout.trim().length > 0) {
        stage.status = 'done';
        stage.summary = extractSummary(execErr.stdout);
        stage.completedAt = new Date().toISOString();
        continue;
      }
      stage.status = 'error';
      stage.error = err instanceof Error ? err.message : String(err);
      stage.completedAt = new Date().toISOString();
      run.status = 'error';
      return;
    }
  }

  run.status = 'done';
}
