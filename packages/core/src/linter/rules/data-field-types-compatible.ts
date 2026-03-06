import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/** Mapping of semantic roles to compatible SQL column type patterns. */
const ROLE_TYPE_PATTERNS: Record<string, RegExp> = {
  metric: /^(int|integer|bigint|smallint|tinyint|hugeint|float|double|decimal|numeric|number|real|money)/i,
  date: /^(date|time|timestamp|datetime)/i,
  identifier: /^(int|integer|bigint|smallint|tinyint|hugeint|varchar|char|text|string|uuid|number)/i,
  dimension: /^(varchar|char|text|string|bool|boolean|int|integer|bigint|smallint|tinyint|hugeint|float|double|decimal|numeric|real|number)/i,
};

export const dataFieldTypesCompatible: LintRule = {
  id: 'data/field-types-compatible',
  defaultSeverity: 'warning',
  description: 'Governance semantic roles should be compatible with the actual column types in the database',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];

    for (const [govKey, gov] of graph.governance) {
      if (!gov.fields) continue;

      const model = graph.models.get(gov.model);
      if (!model) continue;

      for (const [fieldKey, fieldGov] of Object.entries(gov.fields)) {
        const parts = fieldKey.split('.');
        if (parts.length !== 2) continue;
        const [dsName, fieldName] = parts as [string, string];

        const dataset = model.datasets.find((d) => d.name === dsName);
        if (!dataset) continue;

        const tableName = dataset.source?.split('.').pop() ?? dataset.name;
        const columns = graph.dataValidation.existingColumns.get(tableName);
        if (!columns) continue;

        const columnType = columns.get(fieldName);
        if (!columnType) continue;

        const role = fieldGov.semantic_role;
        if (!role) continue;
        const pattern = ROLE_TYPE_PATTERNS[role];
        if (pattern && !pattern.test(columnType)) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Field "${fieldKey}" has semantic role "${role}" but column type "${columnType}" may not be compatible`,
            location: { file: `governance:${govKey}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
