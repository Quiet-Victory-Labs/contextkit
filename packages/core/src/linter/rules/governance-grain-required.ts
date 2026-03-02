import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceGrainRequired: LintRule = {
  id: 'governance/grain-required',
  defaultSeverity: 'warning',
  description: 'Every dataset in governance must have a grain statement',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.datasets) continue;

      for (const [dsName, ds] of Object.entries(gov.datasets)) {
        if (!ds.grain) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Dataset "${dsName}" in governance for model "${gov.model}" is missing a grain statement`,
            location: { file: `governance:${key}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
