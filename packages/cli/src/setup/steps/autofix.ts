import * as p from '@clack/prompts';
import fs from 'node:fs';
import {
  compile,
  LintEngine,
  ALL_RULES,
  applyFixes,
  computeTier,
  loadConfig,
  createAdapter,
} from '@runcontext/core';
import { collectDataValidation } from '../../commands/verify.js';
import type { SetupContext, StepResult } from '../types.js';
import { displayTierScore } from '../display.js';

export async function runAutofixStep(ctx: SetupContext): Promise<StepResult> {
  const config = loadConfig(ctx.cwd);
  const { graph } = await compile({ contextDir: ctx.contextDir, config, rootDir: ctx.cwd });

  // Collect data validation for data-aware fixes
  graph.dataValidation = await collectDataValidation(ctx.adapter, graph);

  const engine = new LintEngine();
  for (const rule of ALL_RULES) engine.register(rule);
  const diagnostics = engine.run(graph);
  const fixable = diagnostics.filter((d) => d.fixable);

  if (fixable.length === 0) {
    p.log.success('No fixable issues found.');
    ctx.graph = graph;
    ctx.tierScore = computeTier(ctx.modelName, graph);
    return { skipped: true, summary: 'Nothing to fix' };
  }

  const shouldRun = await p.confirm({
    message: `Auto-fix ${fixable.length} issue(s)?`,
  });
  if (p.isCancel(shouldRun) || !shouldRun) {
    return { skipped: true, summary: 'Skipped' };
  }

  const spin = p.spinner();
  spin.start('Fixing...');

  const readFile = (filePath: string) => fs.readFileSync(filePath, 'utf-8');
  const fixedFiles = applyFixes(fixable, readFile);

  for (const [file, content] of fixedFiles) {
    fs.writeFileSync(file, content, 'utf-8');
  }

  // Recompile and score
  const { graph: newGraph } = await compile({ contextDir: ctx.contextDir, config, rootDir: ctx.cwd });
  ctx.graph = newGraph;
  ctx.tierScore = computeTier(ctx.modelName, newGraph);

  spin.stop(`Fixed ${fixable.length} issue(s) in ${fixedFiles.size} file(s)`);
  displayTierScore(ctx.tierScore);

  return { skipped: false, summary: `${fixable.length} issues fixed` };
}
