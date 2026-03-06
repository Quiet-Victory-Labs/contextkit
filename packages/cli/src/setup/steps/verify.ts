import * as p from '@clack/prompts';
import {
  compile,
  LintEngine,
  ALL_RULES,
  computeTier,
  loadConfig,
} from '@runcontext/core';
import { collectDataValidation } from '../../commands/verify.js';
import type { SetupContext, StepResult } from '../types.js';
import { displayTierScore } from '../display.js';

export async function runVerifyStep(ctx: SetupContext): Promise<StepResult> {
  const shouldRun = await p.confirm({
    message: 'Verify metadata against live data?',
  });
  if (p.isCancel(shouldRun) || !shouldRun) {
    return { skipped: true, summary: 'Skipped' };
  }

  const spin = p.spinner();
  spin.start('Verifying against database...');

  const config = loadConfig(ctx.cwd);
  const { graph } = await compile({ contextDir: ctx.contextDir, config, rootDir: ctx.cwd });

  graph.dataValidation = await collectDataValidation(ctx.adapter, graph);

  const engine = new LintEngine();
  for (const rule of ALL_RULES) {
    if (rule.id.startsWith('data/')) engine.register(rule);
  }
  const dataDiags = engine.run(graph);

  ctx.graph = graph;
  ctx.tierScore = computeTier(ctx.modelName, graph);

  const errors = dataDiags.filter((d) => d.severity === 'error').length;
  const warnings = dataDiags.filter((d) => d.severity === 'warning').length;

  if (dataDiags.length === 0) {
    spin.stop('All data validation checks passed');
  } else {
    spin.stop(`${errors} error(s), ${warnings} warning(s)`);
    const details = dataDiags
      .map((d) => `  ${d.severity === 'error' ? 'x' : '!'} ${d.message}`)
      .join('\n');
    p.note(details, 'Data Validation Issues');
  }

  return {
    skipped: false,
    summary: dataDiags.length === 0 ? 'Clean' : `${errors} errors, ${warnings} warnings`,
  };
}
