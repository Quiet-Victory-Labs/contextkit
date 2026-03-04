import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataFieldsExist: LintRule = {
  id: 'data/fields-exist',
  defaultSeverity: 'error',
  description: 'Every OSI field must exist as a column in the corresponding database table',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      for (const ds of model.datasets) {
        const tableName = ds.source?.split('.').pop() ?? ds.name;
        const columns = graph.dataValidation.existingColumns.get(tableName);
        if (!columns) continue; // data-source-exists handles missing tables

        for (const field of ds.fields ?? []) {
          if (!columns.has(field.name)) {
            diagnostics.push({
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Field "${field.name}" in dataset "${ds.name}" does not exist as a column in table "${tableName}"`,
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
