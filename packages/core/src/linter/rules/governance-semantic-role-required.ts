import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceSemanticRoleRequired: LintRule = {
  id: 'governance/semantic-role-required',
  defaultSeverity: 'warning',
  description: 'Every field in every dataset of a governed model must have a governance entry with semantic_role',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      // Only check models that have governance
      const gov = graph.governance.get(modelName);
      if (!gov) continue;

      const govFields = gov.fields ?? {};

      for (const dataset of model.datasets) {
        if (!dataset.fields) continue;

        for (const field of dataset.fields) {
          const fieldKey = `${dataset.name}.${field.name}`;
          const govField = govFields[fieldKey];

          if (!govField || !govField.semantic_role) {
            diagnostics.push({
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Field "${fieldKey}" in model "${modelName}" is missing a semantic_role in governance`,
              location: { file: `governance:${modelName}`, line: 1, column: 1 },
              fixable: false,
            });
          }
        }
      }
    }

    return diagnostics;
  },
};
