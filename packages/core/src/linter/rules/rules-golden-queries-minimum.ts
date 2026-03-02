import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const rulesGoldenQueriesMinimum: LintRule = {
  id: 'rules/golden-queries-minimum',
  defaultSeverity: 'warning',
  description: 'Models with a rules file must have at least 3 golden queries',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, rules] of graph.rules) {
      const count = rules.golden_queries?.length ?? 0;
      if (count < 3) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Rules for model "${rules.model}" has ${count} golden queries (minimum 3 required)`,
          location: { file: `rules:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
