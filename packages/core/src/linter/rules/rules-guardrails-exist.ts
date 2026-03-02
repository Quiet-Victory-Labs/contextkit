import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const rulesGuardrailsExist: LintRule = {
  id: 'rules/guardrails-exist',
  defaultSeverity: 'warning',
  description: 'Models with a rules file must have at least 1 guardrail filter',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, rules] of graph.rules) {
      const count = rules.guardrail_filters?.length ?? 0;
      if (count < 1) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Rules for model "${rules.model}" has no guardrail filters (at least 1 required)`,
          location: { file: `rules:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
