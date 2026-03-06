import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceFieldsExist: LintRule = {
  id: 'governance/fields-exist',
  defaultSeverity: 'error',
  description: 'Every field key in governance must exist as a field in the referenced OSI model dataset',
  fixable: false,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.fields) continue;

      const model = graph.models.get(gov.model);
      if (!model) continue; // governance-model-exists handles this

      for (const fieldKey of Object.keys(gov.fields)) {
        const parts = fieldKey.split('.');
        if (parts.length !== 2) continue;
        const [dsName, fieldName] = parts as [string, string];

        const dataset = model.datasets.find((d) => d.name === dsName);
        if (!dataset) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Governance field "${fieldKey}" references dataset "${dsName}" which does not exist in model "${gov.model}"`,
            location: { file: `governance:${key}`, line: 1, column: 1 },
            fixable: false,
          });
          continue;
        }

        const validFields = new Set(dataset.fields?.map((f) => f.name) ?? []);
        if (!validFields.has(fieldName)) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Governance field "${fieldKey}" references field "${fieldName}" which does not exist in dataset "${dsName}"`,
            location: { file: `governance:${key}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
