import type { DataAdapter, AdapterType, TableInfo, ColumnInfo, QueryResult } from '@runcontext/core';
import { applyRowLimit, DEFAULT_ROW_LIMIT, validateReadOnlySQL, MAX_QUERY_ROW_LIMIT } from './guardrails.js';

// ---------------------------------------------------------------------------
// db_list_schemas
// ---------------------------------------------------------------------------

export interface ListSchemasResult {
  schemas: string[];
}

/**
 * List all schemas in the database.
 * Falls back to adapter-specific queries when information_schema is unavailable.
 */
export async function listSchemas(
  adapter: DataAdapter,
  adapterType: AdapterType,
): Promise<ListSchemasResult> {
  let sql: string;

  switch (adapterType) {
    case 'sqlite':
    case 'duckdb':
      sql = "SELECT DISTINCT schema_name FROM information_schema.schemata ORDER BY schema_name";
      break;
    case 'bigquery':
      sql = "SELECT schema_name FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY schema_name";
      break;
    case 'databricks':
      sql = "SHOW SCHEMAS";
      break;
    default:
      // postgres, mysql, mssql, snowflake, clickhouse all support information_schema
      sql = "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name";
  }

  try {
    const result = await adapter.query(sql);
    const schemas = result.rows.map((row) => {
      const firstCol = result.columns[0];
      return String(firstCol ? row[firstCol] : Object.values(row)[0]);
    });
    return { schemas };
  } catch {
    // Fallback: return empty if information_schema not available
    return { schemas: [] };
  }
}

// ---------------------------------------------------------------------------
// db_list_tables
// ---------------------------------------------------------------------------

export interface ListTablesResult {
  tables: TableInfo[];
}

/**
 * List all tables with metadata (row counts, types, schema).
 * Delegates to the adapter's listTables().
 */
export async function listTables(adapter: DataAdapter): Promise<ListTablesResult> {
  const tables = await adapter.listTables();
  return { tables };
}

// ---------------------------------------------------------------------------
// db_describe_table
// ---------------------------------------------------------------------------

export interface DescribeTableResult {
  table: string;
  columns: ColumnInfo[];
}

/**
 * Describe a table's columns including types, nullability, and primary keys.
 * Delegates to the adapter's listColumns().
 */
export async function describeTable(
  adapter: DataAdapter,
  table: string,
): Promise<DescribeTableResult> {
  const columns = await adapter.listColumns(table);
  return { table, columns };
}

// ---------------------------------------------------------------------------
// db_sample_values
// ---------------------------------------------------------------------------

export interface SampleValuesResult {
  table: string;
  query: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
}

/**
 * Sample rows from a table with guardrails applied.
 * Maximum of DEFAULT_ROW_LIMIT (100) rows.
 */
export async function sampleValues(
  adapter: DataAdapter,
  table: string,
  limit?: number,
): Promise<SampleValuesResult> {
  const effectiveLimit = Math.min(limit ?? DEFAULT_ROW_LIMIT, DEFAULT_ROW_LIMIT);
  const sql = applyRowLimit(`SELECT * FROM ${quoteIdentifier(table)}`, effectiveLimit);
  const result = await adapter.query(sql);
  return {
    table,
    query: sql,
    columns: result.columns,
    rows: result.rows,
    row_count: result.row_count,
  };
}

// ---------------------------------------------------------------------------
// db_relationships
// ---------------------------------------------------------------------------

export interface Relationship {
  constraint_name: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

export interface RelationshipsResult {
  relationships: Relationship[];
}

/**
 * List foreign key relationships from information_schema.
 * Falls back to adapter-specific queries or empty results.
 */
export async function listRelationships(
  adapter: DataAdapter,
  adapterType: AdapterType,
  table?: string,
): Promise<RelationshipsResult> {
  let sql: string;

  switch (adapterType) {
    case 'postgres':
    case 'mysql':
    case 'mssql':
    case 'snowflake': {
      const whereClause = table
        ? `AND kcu.table_name = '${escapeString(table)}'`
        : '';
      sql = `
        SELECT
          kcu.constraint_name,
          kcu.table_name AS source_table,
          kcu.column_name AS source_column,
          ccu.table_name AS target_table,
          ccu.column_name AS target_column
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.constraint_column_usage ccu
          ON kcu.constraint_name = ccu.constraint_name
        JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        ${whereClause}
        ORDER BY kcu.constraint_name, kcu.ordinal_position
      `;
      break;
    }
    case 'sqlite': {
      if (!table) {
        // SQLite requires table-specific PRAGMA; list all tables then query each
        const tables = await adapter.listTables();
        const allRels: Relationship[] = [];
        for (const t of tables) {
          try {
            const result = await adapter.query(`PRAGMA foreign_key_list("${t.name.replace(/"/g, '""')}")`);
            for (const row of result.rows) {
              allRels.push({
                constraint_name: `fk_${t.name}_${row['from']}`,
                source_table: t.name,
                source_column: String(row['from']),
                target_table: String(row['table']),
                target_column: String(row['to']),
              });
            }
          } catch {
            // skip tables without FK support
          }
        }
        return { relationships: allRels };
      }
      sql = `PRAGMA foreign_key_list("${table.replace(/"/g, '""')}")`;
      try {
        const result = await adapter.query(sql);
        const relationships = result.rows.map((row) => ({
          constraint_name: `fk_${table}_${row['from']}`,
          source_table: table,
          source_column: String(row['from']),
          target_table: String(row['table']),
          target_column: String(row['to']),
        }));
        return { relationships };
      } catch {
        return { relationships: [] };
      }
    }
    case 'duckdb': {
      const whereClause = table
        ? `WHERE source_table = '${escapeString(table)}'`
        : '';
      sql = `
        SELECT
          constraint_name,
          source_table,
          source_column,
          target_table,
          target_column
        FROM (
          SELECT
            dc.constraint_name,
            dc.table_name AS source_table,
            unnest(dc.constraint_column_names) AS source_column,
            rc.table_name AS target_table,
            unnest(rc.constraint_column_names) AS target_column
          FROM duckdb_constraints() dc
          JOIN duckdb_constraints() rc
            ON dc.constraint_name IS NOT NULL
            AND dc.constraint_type = 'FOREIGN KEY'
            AND rc.constraint_type = 'PRIMARY KEY'
        ) sub
        ${whereClause}
        ORDER BY constraint_name
      `;
      break;
    }
    default:
      // bigquery, clickhouse, databricks generally don't enforce FKs
      return { relationships: [] };
  }

  try {
    const result = await adapter.query(sql);
    const relationships: Relationship[] = result.rows.map((row) => ({
      constraint_name: String(row['constraint_name'] ?? ''),
      source_table: String(row['source_table'] ?? ''),
      source_column: String(row['source_column'] ?? ''),
      target_table: String(row['target_table'] ?? ''),
      target_column: String(row['target_column'] ?? ''),
    }));
    return { relationships };
  } catch {
    return { relationships: [] };
  }
}

// ---------------------------------------------------------------------------
// db_query
// ---------------------------------------------------------------------------

export interface ExecuteQueryResult {
  query: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
}

/**
 * Execute a read-only SQL query with guardrails.
 * Validates the query, applies row limits, and returns the results.
 */
export async function executeQuery(
  adapter: DataAdapter,
  sql: string,
  limit?: number,
): Promise<ExecuteQueryResult> {
  const validation = validateReadOnlySQL(sql);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const effectiveLimit = Math.min(limit ?? DEFAULT_ROW_LIMIT, MAX_QUERY_ROW_LIMIT);
  const limitedSql = applyRowLimit(sql, effectiveLimit);
  const result = await adapter.query(limitedSql);

  return {
    query: limitedSql,
    columns: result.columns,
    rows: result.rows,
    row_count: result.row_count,
    truncated: result.row_count >= effectiveLimit,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function quoteIdentifier(name: string): string {
  // Simple quoting — handles most cases. Schema.table supported.
  if (name.includes('.')) {
    return name
      .split('.')
      .map((part) => `"${part.replace(/"/g, '""')}"`)
      .join('.');
  }
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeString(value: string): string {
  return value.replace(/'/g, "''");
}
