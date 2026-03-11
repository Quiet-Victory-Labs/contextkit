import type { ColumnInfo, TableInfo } from '../adapters/types.js';

const DATE_TYPES = ['DATE', 'TIMESTAMP', 'TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE', 'timestamp without time zone', 'timestamp with time zone', 'date'];
const NUMERIC_TYPES = ['INTEGER', 'BIGINT', 'SMALLINT', 'DOUBLE', 'FLOAT', 'REAL', 'DECIMAL', 'NUMERIC', 'numeric', 'integer', 'bigint', 'smallint', 'double precision', 'real'];
const METRIC_PATTERNS = /count|total|sum|amount|pct|rate|avg|median|revenue|cost|price|score|population|income/i;

export function inferTableType(
  tableName: string,
  dbType: 'table' | 'view',
  columns: ColumnInfo[],
): string {
  if (dbType === 'view') return 'view';

  const hasPK = columns.some((c) => c.is_primary_key);
  const hasDateCol = columns.some((c) => DATE_TYPES.includes(c.data_type));
  const numericCols = columns.filter((c) => NUMERIC_TYPES.includes(c.data_type));
  const textCols = columns.filter((c) => c.data_type.toUpperCase().includes('VARCHAR') || c.data_type.toUpperCase().includes('TEXT'));
  const fkCols = columns.filter((c) => c.is_foreign_key || (!c.is_primary_key && c.name.endsWith('_id')));

  if (hasDateCol && !hasPK) return 'event';
  if (fkCols.length > 0 && numericCols.length > fkCols.length) return 'fact';
  if (hasPK && textCols.length >= numericCols.length) return 'dimension';

  return 'dimension';
}

export function inferGrain(tableName: string, columns: ColumnInfo[]): string {
  const pkCols = columns.filter((c) => c.is_primary_key);

  if (pkCols.length === 1) {
    return `one row per ${tableName} identified by ${pkCols[0]!.name}`;
  }
  if (pkCols.length > 1) {
    return `one row per unique combination of ${pkCols.map((c) => c.name).join(', ')}`;
  }
  return 'one row per record (no primary key detected)';
}

export function inferSemanticRole(
  columnName: string,
  dataType: string,
  isPrimaryKey: boolean,
  isForeignKey?: boolean,
): 'identifier' | 'metric' | 'dimension' | 'date' {
  if (isPrimaryKey || isForeignKey || columnName.endsWith('_id')) return 'identifier';
  if (DATE_TYPES.includes(dataType)) return 'date';
  if (NUMERIC_TYPES.includes(dataType) && METRIC_PATTERNS.test(columnName)) return 'metric';
  return 'dimension';
}

export function inferAggregation(columnName: string): 'SUM' | 'AVG' | 'MAX' | 'MIN' {
  const lower = columnName.toLowerCase();
  if (/avg|pct|rate|median/.test(lower)) return 'AVG';
  if (/max/.test(lower)) return 'MAX';
  if (/min/.test(lower)) return 'MIN';
  return 'SUM';
}

/**
 * Infer relationships from foreign key metadata on columns.
 */
export function inferRelationships(
  tableName: string,
  columns: ColumnInfo[],
): { column: string; references: string; referenced_column: string }[] {
  return columns
    .filter((c) => c.is_foreign_key && c.referenced_table)
    .map((c) => ({
      column: c.name,
      references: c.referenced_table!,
      referenced_column: c.referenced_column!,
    }));
}

/**
 * Infer guardrail rules from check constraints and enum values.
 */
export function inferGuardrails(
  table: TableInfo,
  columns: ColumnInfo[],
): { field: string; rule: string }[] {
  const rules: { field: string; rule: string }[] = [];

  // Enum columns → allowed values guardrail
  for (const col of columns) {
    if (col.enum_values && col.enum_values.length > 0) {
      rules.push({
        field: col.name,
        rule: `Allowed values: ${col.enum_values.join(', ')}`,
      });
    }
  }

  // Check constraints → filter guardrails
  if (table.check_constraints) {
    for (const check of table.check_constraints) {
      rules.push({
        field: check.name,
        rule: `CHECK: ${check.expression}`,
      });
    }
  }

  return rules;
}
