import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataSampleValuesAccurate: LintRule = {
  id: 'data/sample-values-accurate',
  defaultSeverity: 'warning',
  description: 'Governance sample_values should match actual values found in the database',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];

    for (const [govKey, gov] of graph.governance) {
      if (!gov.fields) continue;

      for (const [fieldKey, fieldGov] of Object.entries(gov.fields)) {
        if (!fieldGov.sample_values || fieldGov.sample_values.length === 0) continue;

        const actualValues = graph.dataValidation.actualSampleValues.get(fieldKey);
        if (!actualValues || actualValues.length === 0) continue;

        const actualSet = new Set(actualValues.map((v) => String(v).toLowerCase()));
        const mismatched = fieldGov.sample_values.filter(
          (sv) => !actualSet.has(String(sv).toLowerCase()),
        );

        if (mismatched.length > 0) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Field "${fieldKey}" has sample_values [${mismatched.join(', ')}] not found in actual data`,
            location: { file: `governance:${govKey}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
