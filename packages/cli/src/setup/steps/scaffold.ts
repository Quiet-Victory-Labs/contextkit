import * as p from '@clack/prompts';
import path from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { scaffoldFromSchema, compile, computeTier, loadConfig } from '@runcontext/core';
import type { SetupContext, StepResult } from '../types.js';
import { displayTierScore } from '../display.js';

export async function runScaffoldStep(ctx: SetupContext): Promise<StepResult> {
  const shouldRun = await p.confirm({
    message: 'Scaffold Bronze metadata from database schema?',
  });
  if (p.isCancel(shouldRun) || !shouldRun) {
    return { skipped: true, summary: 'Skipped' };
  }

  const spin = p.spinner();
  spin.start('Scaffolding Bronze metadata...');

  const result = scaffoldFromSchema({
    modelName: ctx.modelName,
    dataSourceName: 'default',
    tables: ctx.tables,
    columns: ctx.columns,
  });

  // Create directories
  for (const dir of ['models', 'governance', 'owners']) {
    const dirPath = path.join(ctx.contextDir, dir);
    if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
  }

  // Write files
  const created: string[] = [];
  const files = [
    { rel: path.join('models', result.files.osi), content: result.osiYaml },
    { rel: path.join('governance', result.files.governance), content: result.governanceYaml },
    { rel: path.join('owners', result.files.owner), content: result.ownerYaml },
  ];

  for (const f of files) {
    const fullPath = path.join(ctx.contextDir, f.rel);
    writeFileSync(fullPath, f.content, 'utf-8');
    created.push(f.rel);
  }

  // Recompile and compute tier
  const config = loadConfig(ctx.cwd);
  const { graph } = await compile({ contextDir: ctx.contextDir, config, rootDir: ctx.cwd });
  ctx.graph = graph;
  ctx.tierScore = computeTier(ctx.modelName, graph);

  spin.stop(`Created ${created.length} files`);

  const fileList = created.map((f) => `  ${f}`).join('\n');
  p.note(fileList, 'Files Created');
  displayTierScore(ctx.tierScore);

  return { skipped: false, summary: `${created.length} files → ${ctx.tierScore.tier.toUpperCase()}` };
}
