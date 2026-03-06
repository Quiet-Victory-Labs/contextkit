import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const ownershipRequired: LintRule = {
  id: 'governance/ownership-required',
  defaultSeverity: 'error',
  description: 'Every governance file must have an owner field set',
  fixable: false,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.owner) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Governance for model "${gov.model}" is missing an owner`,
          location: { file: `governance:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
