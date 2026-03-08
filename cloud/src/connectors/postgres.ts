/**
 * Postgres / Neon Connector
 *
 * Read-only database introspection via information_schema queries.
 * Uses the `pg` (node-postgres) library.
 */

import { BaseConnector, ConnectorError } from './base.js';
import type {
  ColumnMeta,
  ConnectorConfig,
  RelationshipCandidate,
  TableMeta,
  TableStats,
} from './types.js';

// ── Postgres-specific configuration ───────────────────────────────

export interface PostgresConnectorConfig extends ConnectorConfig {
  /** pg.Pool constructor options (host, port, database, user, password, ssl, etc.) */
  connection: {
    host: string;
    port?: number;
    database: string;
    user: string;
    password?: string;
    ssl?: boolean | object;
    connectionTimeoutMillis?: number;
  };
}

// ── Connector ─────────────────────────────────────────────────────

export class PostgresConnector extends BaseConnector {
  private pool: import('pg').Pool | null = null;
  private readonly connectionConfig: PostgresConnectorConfig['connection'];

  constructor(private readonly config: PostgresConnectorConfig) {
    super(config);
    this.connectionConfig = config.connection;
  }

  // ── Connection lifecycle ───────────────────────────────────────

  protected async doConnect(): Promise<void> {
    // Dynamic import so pg is only required when actually used
    const { Pool } = await import('pg');
    this.pool = new Pool({
      ...this.connectionConfig,
      connectionTimeoutMillis:
        this.connectionConfig.connectionTimeoutMillis ?? this.queryTimeoutMs,
    });

    // Verify the connection works
    const client = await this.pool.connect();
    client.release();
  }

  protected async doDisconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  // ── Query helper ───────────────────────────────────────────────

  private async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    this.assertConnected();
    this.validateSql(sql);
    const limited = this.applySqlRowLimit(sql);
    const result = await this.withTimeout(() => this.pool!.query(limited, params));
    return result.rows as T[];
  }

  // ── Introspection methods ──────────────────────────────────────

  async listSchemas(): Promise<string[]> {
    const rows = await this.query<{ schema_name: string }>(
      `SELECT schema_name
         FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schema_name`,
    );
    return rows.map((r) => r.schema_name);
  }

  async listTables(schema?: string): Promise<TableMeta[]> {
    const where = schema
      ? `AND t.table_schema = $1`
      : `AND t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')`;

    const params = schema ? [schema] : [];

    const sql = `
      SELECT
        t.table_schema  AS schema,
        t.table_name    AS name,
        CASE t.table_type
          WHEN 'BASE TABLE' THEN 'table'
          WHEN 'VIEW'       THEN 'view'
          ELSE 'table'
        END             AS type
      FROM information_schema.tables t
      WHERE 1=1 ${where}
      ORDER BY t.table_schema, t.table_name`;

    const rows = await this.query<{ schema: string; name: string; type: 'table' | 'view' }>(
      sql,
      params,
    );

    return rows.map((r) => ({
      schema: r.schema,
      name: r.name,
      type: r.type,
    }));
  }

  async describeTable(schema: string, table: string): Promise<ColumnMeta[]> {
    const sql = `
      SELECT
        c.column_name      AS name,
        c.data_type        AS data_type,
        CASE c.is_nullable WHEN 'YES' THEN true ELSE false END AS nullable,
        c.column_default   AS default_value
      FROM information_schema.columns c
      WHERE c.table_schema = $1
        AND c.table_name   = $2
      ORDER BY c.ordinal_position`;

    const columns = await this.query<{
      name: string;
      data_type: string;
      nullable: boolean;
      default_value: string | null;
    }>(sql, [schema, table]);

    // Fetch primary key columns
    const pkSql = `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema    = $1
        AND tc.table_name      = $2`;

    const pkRows = await this.query<{ column_name: string }>(pkSql, [schema, table]);
    const pkColumns = new Set(pkRows.map((r) => r.column_name));

    return columns.map((c) => ({
      name: c.name,
      data_type: c.data_type,
      nullable: c.nullable,
      is_primary_key: pkColumns.has(c.name),
      default_value: c.default_value ?? undefined,
    }));
  }

  async getTableStats(schema: string, table: string): Promise<TableStats> {
    // Use pg_class for row estimate and size — these are catalog views, not mutations.
    // Fall back to information_schema if pg_class is not accessible.
    try {
      const sql = `
        SELECT
          c.reltuples::bigint AS row_count_estimate,
          pg_total_relation_size(c.oid) AS size_bytes
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1
          AND c.relname = $2`;

      const rows = await this.query<{ row_count_estimate: string; size_bytes: string }>(sql, [
        schema,
        table,
      ]);

      if (rows.length > 0) {
        return {
          schema,
          table,
          row_count_estimate: Math.max(0, parseInt(rows[0].row_count_estimate, 10)),
          size_bytes: parseInt(rows[0].size_bytes, 10),
        };
      }
    } catch {
      // Fall through to default
    }

    return {
      schema,
      table,
      row_count_estimate: 0,
    };
  }

  async getViewDefinition(schema: string, view: string): Promise<string | null> {
    const sql = `
      SELECT view_definition
      FROM information_schema.views
      WHERE table_schema = $1
        AND table_name   = $2`;

    const rows = await this.query<{ view_definition: string }>(sql, [schema, view]);
    return rows.length > 0 ? rows[0].view_definition : null;
  }

  async detectRelationships(schema?: string): Promise<RelationshipCandidate[]> {
    const where = schema ? `WHERE tc.table_schema = $1` : '';
    const params = schema ? [schema] : [];

    const sql = `
      SELECT
        kcu.table_schema   AS from_schema,
        kcu.table_name     AS from_table,
        kcu.column_name    AS from_column,
        ccu.table_schema   AS to_schema,
        ccu.table_name     AS to_table,
        ccu.column_name    AS to_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      ${where}
        ${where ? 'AND' : 'WHERE'} tc.constraint_type = 'FOREIGN KEY'
      ORDER BY kcu.table_schema, kcu.table_name`;

    const rows = await this.query<{
      from_schema: string;
      from_table: string;
      from_column: string;
      to_schema: string;
      to_table: string;
      to_column: string;
    }>(sql, params);

    return rows.map((r) => ({
      from_schema: r.from_schema,
      from_table: r.from_table,
      from_column: r.from_column,
      to_schema: r.to_schema,
      to_table: r.to_table,
      to_column: r.to_column,
      confidence: 'high' as const,
      reason: 'Foreign key constraint',
    }));
  }
}
