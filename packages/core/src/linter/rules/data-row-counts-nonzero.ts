import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataRowCountsNonzero: LintRule = {
  id: 'data/row-counts-nonzero',
  defaultSeverity: 'warning',
  description: 'Dataset source tables should contain at least one row of data',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      for (const ds of model.datasets) {
        const tableName = ds.source?.split('.').pop() ?? ds.name;
        const rowCount = graph.dataValidation.existingTables.get(tableName);

        // Only warn if the table exists but has zero rows
        if (rowCount !== undefined && rowCount === 0) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Table "${tableName}" for dataset "${ds.name}" has 0 rows`,
            location: { file: `model:${modelName}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
