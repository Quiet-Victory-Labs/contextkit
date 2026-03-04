import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataSourceExists: LintRule = {
  id: 'data/source-exists',
  defaultSeverity: 'error',
  description: "Every dataset's source table must exist in the connected database",
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      for (const ds of model.datasets) {
        const tableName = ds.source?.split('.').pop() ?? ds.name;
        if (!graph.dataValidation.existingTables.has(tableName)) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Dataset "${ds.name}" references table "${tableName}" which does not exist in the database`,
            location: { file: `model:${modelName}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
