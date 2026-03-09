import type { AdapterType } from '@runcontext/core';

/**
 * Returns SQL statement(s) to set the session to read-only mode for the given adapter.
 * Returns null if the adapter does not support session-level read-only enforcement.
 */
export function enforceReadOnly(adapter: AdapterType): string | null {
  switch (adapter) {
    case 'postgres':
      return 'SET default_transaction_read_only = ON';
    case 'mysql':
      return 'SET SESSION TRANSACTION READ ONLY';
    case 'duckdb':
      return 'PRAGMA enable_object_cache'; // DuckDB doesn't have a read-only session toggle via SQL; return null
    case 'mssql':
      return 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED'; // MSSQL doesn't support session read-only via SQL
    case 'snowflake':
      return null; // Snowflake uses role-based access; no session-level read-only SQL
    case 'bigquery':
      return null; // BigQuery is read-only for queries by default (no DML in standard SQL mode)
    case 'clickhouse':
      return 'SET readonly = 1';
    case 'databricks':
      return null; // Databricks uses role-based access control
    case 'sqlite':
      return 'PRAGMA query_only = ON';
    default:
      return null;
  }
}

/**
 * Wraps a SQL query with a LIMIT clause to cap the number of rows returned.
 * If the query already contains a LIMIT clause, replaces it with the lower value.
 */
export function applyRowLimit(query: string, limit: number): string {
  const trimmed = query.trim().replace(/;+\s*$/, '');

  // Check if query already has a LIMIT clause (case-insensitive)
  const limitMatch = trimmed.match(/\bLIMIT\s+(\d+)\s*$/i);
  if (limitMatch) {
    const existingLimit = parseInt(limitMatch[1]!, 10);
    const effectiveLimit = Math.min(existingLimit, limit);
    return trimmed.replace(/\bLIMIT\s+\d+\s*$/i, `LIMIT ${effectiveLimit}`);
  }

  return `${trimmed}\nLIMIT ${limit}`;
}

/**
 * Returns SQL statement to set query timeout for the given adapter.
 * Returns null if the adapter does not support statement-level timeouts via SQL.
 */
export function applyTimeout(adapter: AdapterType, ms: number): string | null {
  switch (adapter) {
    case 'postgres':
      return `SET statement_timeout = ${ms}`;
    case 'mysql':
      // MySQL MAX_EXECUTION_TIME is in milliseconds
      return `SET SESSION MAX_EXECUTION_TIME = ${ms}`;
    case 'duckdb':
      return null; // DuckDB doesn't support statement timeouts via SQL
    case 'mssql':
      return null; // MSSQL uses connection-level timeouts, not SQL
    case 'snowflake':
      return `ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = ${Math.ceil(ms / 1000)}`;
    case 'bigquery':
      return null; // BigQuery uses API-level timeouts
    case 'clickhouse':
      return `SET max_execution_time = ${Math.ceil(ms / 1000)}`;
    case 'databricks':
      return null; // Databricks uses API-level timeouts
    case 'sqlite':
      return null; // SQLite uses API-level timeouts
    default:
      return null;
  }
}

/** Default row limit for sample queries. */
export const DEFAULT_ROW_LIMIT = 100;

/** Maximum row limit for db_query tool. */
export const MAX_QUERY_ROW_LIMIT = 1000;

/** Default query timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// SQL validation for db_query
// ---------------------------------------------------------------------------

export interface SQLValidation {
  valid: boolean;
  reason?: string;
}

/** Disallowed statement prefixes (case-insensitive). */
const DDL_KEYWORDS = ['CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'RENAME'];
const DML_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT'];
const ADMIN_KEYWORDS = [
  'GRANT', 'REVOKE', 'CALL', 'EXEC', 'COPY', 'LOAD',
  'VACUUM', 'BEGIN', 'COMMIT', 'ROLLBACK', 'LOCK', 'SET', 'RESET',
];
const ALLOWED_KEYWORDS = ['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'VALUES'];

/**
 * Validate that a SQL string is a read-only query safe for execution.
 * Returns `{ valid: true }` if allowed, or `{ valid: false, reason }` if rejected.
 */
export function validateReadOnlySQL(sql: string): SQLValidation {
  const trimmed = sql.trim();

  if (!trimmed) {
    return { valid: false, reason: 'Query is empty' };
  }

  // Reject multi-statement queries (semicolons not at the very end)
  const withoutTrailingSemicolon = trimmed.replace(/;+\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    return { valid: false, reason: 'Multi-statement queries are not allowed' };
  }

  // Extract the first keyword
  const firstWord = trimmed.split(/\s+/)[0]!.toUpperCase();

  // Check against disallowed keywords
  const allDisallowed = [...DDL_KEYWORDS, ...DML_KEYWORDS, ...ADMIN_KEYWORDS];
  if (allDisallowed.includes(firstWord)) {
    return { valid: false, reason: `Statement type '${firstWord}' is not allowed. Only read-only queries are permitted.` };
  }

  // Check against allowed keywords
  if (!ALLOWED_KEYWORDS.includes(firstWord)) {
    return { valid: false, reason: `Statement type '${firstWord}' is not recognized as a read-only query` };
  }

  return { valid: true };
}
