import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceAdditiveRequired: LintRule = {
  id: 'governance/additive-required',
  defaultSeverity: 'warning',
  description: 'Every field with semantic_role "metric" must have additive flag set',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.fields) continue;

      for (const [fieldName, field] of Object.entries(gov.fields)) {
        if (field.semantic_role === 'metric' && field.additive == null) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Metric field "${fieldName}" in governance for model "${gov.model}" is missing additive flag`,
            location: { file: `governance:${key}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
