import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const osiValidSchema: LintRule = {
  id: 'osi/valid-schema',
  defaultSeverity: 'error',
  description: 'OSI models must have at least one dataset',
  fixable: false,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, model] of graph.models) {
      if (!model.datasets || model.datasets.length === 0) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Model "${model.name}" has no datasets`,
          location: { file: `model:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
