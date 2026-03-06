import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

const normalize = (s: string) => s.toLowerCase().replace(/[-_ ]/g, '');

export const governanceFieldDescriptionQuality: LintRule = {
  id: 'governance/field-description-quality',
  defaultSeverity: 'warning',
  description: 'Field descriptions must not just repeat the field name or be under 10 characters',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      const gov = graph.governance.get(modelName);
      if (!gov) continue;

      for (const dataset of model.datasets) {
        for (const field of dataset.fields ?? []) {
          if (!field.description) continue; // descriptions-required covers missing
          if (field.description.length < 10 || normalize(field.description) === normalize(field.name)) {
            diagnostics.push({
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Field "${dataset.name}.${field.name}" in model "${modelName}" has a lazy description (just the column name or under 10 chars)`,
              location: { file: `model:${modelName}`, line: 1, column: 1 },
              fixable: false,
            });
          }
        }
      }
    }

    return diagnostics;
  },
};
