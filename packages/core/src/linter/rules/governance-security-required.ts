import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceSecurityRequired: LintRule = {
  id: 'governance/security-required',
  defaultSeverity: 'warning',
  description: 'Every governance file must have a security classification',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.security) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Governance for model "${gov.model}" is missing a security classification`,
          location: { file: `governance:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
