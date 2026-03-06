import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceAggregationRequired: LintRule = {
  id: 'governance/aggregation-required',
  defaultSeverity: 'warning',
  description: 'Every field with semantic_role "metric" must have default_aggregation set',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.fields) continue;

      for (const [fieldName, field] of Object.entries(gov.fields)) {
        if (field.semantic_role === 'metric' && !field.default_aggregation) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Metric field "${fieldName}" in governance for model "${gov.model}" is missing default_aggregation`,
            location: { file: `governance:${key}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
