import { Hono } from 'hono';
import { execFile as execFileCb } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

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

  return app;
}

function buildCliArgs(
  stage: PipelineStage,
  dataSource?: string,
): string[] {
  switch (stage) {
    case 'introspect': {
      const args = ['@runcontext/cli', 'introspect'];
      if (dataSource) args.push('--source', dataSource);
      return args;
    }
    case 'scaffold':
      return ['@runcontext/cli', 'build'];
    case 'enrich-silver': {
      const args = ['@runcontext/cli', 'enrich', '--target', 'silver', '--apply'];
      if (dataSource) args.push('--source', dataSource);
      return args;
    }
    case 'enrich-gold': {
      const args = ['@runcontext/cli', 'enrich', '--target', 'gold', '--apply'];
      if (dataSource) args.push('--source', dataSource);
      return args;
    }
    case 'verify':
      return ['@runcontext/cli', 'verify'];
    case 'autofix':
      return ['@runcontext/cli', 'fix'];
    case 'agent-instructions':
      return ['@runcontext/cli', 'build'];
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
      const args = buildCliArgs(stage.stage, dataSource);
      const { stdout } = await execFile('npx', args, {
        cwd: rootDir,
        timeout: 120_000,
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
      });
      stage.status = 'done';
      stage.summary = extractSummary(stdout);
      stage.completedAt = new Date().toISOString();
    } catch (err) {
      stage.status = 'error';
      stage.error = err instanceof Error ? err.message : String(err);
      stage.completedAt = new Date().toISOString();
      run.status = 'error';
      return;
    }
  }

  run.status = 'done';
}
