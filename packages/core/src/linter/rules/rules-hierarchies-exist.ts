import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const rulesHierarchiesExist: LintRule = {
  id: 'rules/hierarchies-exist',
  defaultSeverity: 'warning',
  description: 'Models with a rules file must have at least 1 hierarchy',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, rules] of graph.rules) {
      const count = rules.hierarchies?.length ?? 0;
      if (count < 1) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Rules for model "${rules.model}" has no hierarchies (at least 1 required)`,
          location: { file: `rules:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
