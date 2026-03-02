import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceTrustRequired: LintRule = {
  id: 'governance/trust-required',
  defaultSeverity: 'warning',
  description: 'Governance files must have a trust status set (endorsed/warning/deprecated)',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.trust) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Governance for model "${gov.model}" is missing a trust status (endorsed/warning/deprecated)`,
          location: { file: `governance:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
