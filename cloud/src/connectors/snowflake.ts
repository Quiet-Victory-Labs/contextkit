/**
 * Snowflake Connector
 *
 * Read-only database introspection using INFORMATION_SCHEMA and SHOW commands.
 * Uses the `snowflake-sdk` library.
 */

import { BaseConnector, ConnectorError } from './base.js';
import type {
  ColumnMeta,
  ConnectorConfig,
  RelationshipCandidate,
  TableMeta,
  TableStats,
} from './types.js';

// ── Snowflake-specific configuration ──────────────────────────────

export interface SnowflakeConnectorConfig extends ConnectorConfig {
  connection: {
    account: string;
    username: string;
    password?: string;
    database: string;
    warehouse?: string;
    role?: string;
    authenticator?: string;
    privateKey?: string;
    privateKeyPath?: string;
  };
}

// ── Connector ─────────────────────────────────────────────────────

export class SnowflakeConnector extends BaseConnector {
  private connection: any = null;
  private sdk: any = null;
  private readonly connectionConfig: SnowflakeConnectorConfig['connection'];

  constructor(private readonly config: SnowflakeConnectorConfig) {
    super(config);
    this.connectionConfig = config.connection;
  }

  // ── Connection lifecycle ───────────────────────────────────────

  protected async doConnect(): Promise<void> {
    this.sdk = await import('snowflake-sdk');
    this.connection = this.sdk.createConnection({
      account: this.connectionConfig.account,
      username: this.connectionConfig.username,
      password: this.connectionConfig.password,
      database: this.connectionConfig.database,
      warehouse: this.connectionConfig.warehouse,
      role: this.connectionConfig.role,
      authenticator: this.connectionConfig.authenticator,
      privateKey: this.connectionConfig.privateKey,
      privateKeyPath: this.connectionConfig.privateKeyPath,
    });

    await new Promise<void>((resolve, reject) => {
      this.connection.connect((err: Error | undefined) => {
        if (err) reject(new ConnectorError(`Snowflake connection failed: ${err.message}`));
        else resolve();
      });
    });
  }

  protected async doDisconnect(): Promise<void> {
    if (this.connection) {
      await new Promise<void>((resolve, reject) => {
        this.connection.destroy((err: Error | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.connection = null;
    }
  }

  // ── Query helper ───────────────────────────────────────────────

  private async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    binds: unknown[] = [],
  ): Promise<T[]> {
    this.assertConnected();
    this.validateSql(sql);

    return this.withTimeout(
      () =>
        new Promise<T[]>((resolve, reject) => {
          this.connection.execute({
            sqlText: sql,
            binds,
            complete: (err: Error | undefined, _stmt: unknown, rows: T[] | undefined) => {
              if (err) reject(new ConnectorError(`Snowflake query failed: ${err.message}`));
              else resolve(rows ?? []);
            },
          });
        }),
    );
  }

  // ── Introspection methods ──────────────────────────────────────

  async listSchemas(): Promise<string[]> {
    const rows = await this.query<{ SCHEMA_NAME: string }>(
      `SELECT SCHEMA_NAME
         FROM INFORMATION_SCHEMA.SCHEMATA
        WHERE SCHEMA_NAME NOT IN ('INFORMATION_SCHEMA')
        ORDER BY SCHEMA_NAME`,
    );
    return rows.map((r) => r.SCHEMA_NAME);
  }

  async listTables(schema?: string): Promise<TableMeta[]> {
    const where = schema
      ? `AND TABLE_SCHEMA = '${schema}'`
      : `AND TABLE_SCHEMA != 'INFORMATION_SCHEMA'`;

    const sql = `
      SELECT
        TABLE_SCHEMA AS "schema",
        TABLE_NAME   AS "name",
        TABLE_TYPE   AS "type",
        ROW_COUNT    AS "row_count",
        COMMENT      AS "comment"
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_CATALOG = CURRENT_DATABASE()
        ${where}
      ORDER BY TABLE_SCHEMA, TABLE_NAME`;

    const rows = await this.query<{
      schema: string;
      name: string;
      type: string;
      row_count: number | null;
      comment: string | null;
    }>(sql);

    return rows.map((r) => ({
      schema: r.schema,
      name: r.name,
      type: r.type === 'VIEW' ? ('view' as const) : ('table' as const),
      row_count_estimate: r.row_count ?? undefined,
      comment: r.comment ?? undefined,
    }));
  }

  async describeTable(schema: string, table: string): Promise<ColumnMeta[]> {
    const sql = `
      SELECT
        COLUMN_NAME      AS "name",
        DATA_TYPE        AS "data_type",
        IS_NULLABLE      AS "nullable",
        COLUMN_DEFAULT   AS "default_value",
        COMMENT          AS "comment"
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_CATALOG = CURRENT_DATABASE()
        AND TABLE_SCHEMA  = '${schema}'
        AND TABLE_NAME    = '${table}'
      ORDER BY ORDINAL_POSITION`;

    const columns = await this.query<{
      name: string;
      data_type: string;
      nullable: string;
      default_value: string | null;
      comment: string | null;
    }>(sql);

    // Fetch primary key columns via SHOW PRIMARY KEYS
    let pkColumns = new Set<string>();
    try {
      const pkRows = await this.query<{ column_name: string }>(
        `SHOW PRIMARY KEYS IN "${schema}"."${table}"`,
      );
      pkColumns = new Set(pkRows.map((r) => r.column_name));
    } catch {
      // SHOW may fail for views or restricted objects — ignore
    }

    return columns.map((c) => ({
      name: c.name,
      data_type: c.data_type,
      nullable: c.nullable === 'YES',
      is_primary_key: pkColumns.has(c.name),
      default_value: c.default_value ?? undefined,
      comment: c.comment ?? undefined,
    }));
  }

  async getTableStats(schema: string, table: string): Promise<TableStats> {
    const sql = `
      SELECT
        ROW_COUNT AS "row_count",
        BYTES     AS "size_bytes",
        LAST_ALTERED AS "last_modified"
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_CATALOG = CURRENT_DATABASE()
        AND TABLE_SCHEMA  = '${schema}'
        AND TABLE_NAME    = '${table}'`;

    const rows = await this.query<{
      row_count: number | null;
      size_bytes: number | null;
      last_modified: string | null;
    }>(sql);

    if (rows.length === 0) {
      return { schema, table, row_count_estimate: 0 };
    }

    return {
      schema,
      table,
      row_count_estimate: rows[0].row_count ?? 0,
      size_bytes: rows[0].size_bytes ?? undefined,
      last_modified: rows[0].last_modified ?? undefined,
    };
  }

  async getViewDefinition(schema: string, view: string): Promise<string | null> {
    const sql = `
      SELECT VIEW_DEFINITION
      FROM INFORMATION_SCHEMA.VIEWS
      WHERE TABLE_CATALOG = CURRENT_DATABASE()
        AND TABLE_SCHEMA  = '${schema}'
        AND TABLE_NAME    = '${view}'`;

    const rows = await this.query<{ VIEW_DEFINITION: string }>(sql);
    return rows.length > 0 ? rows[0].VIEW_DEFINITION : null;
  }

  async detectRelationships(schema?: string): Promise<RelationshipCandidate[]> {
    // Snowflake supports IMPORTED/EXPORTED KEYS via SHOW commands
    try {
      const target = schema
        ? `SHOW IMPORTED KEYS IN SCHEMA "${schema}"`
        : `SHOW IMPORTED KEYS IN DATABASE`;

      const rows = await this.query<{
        fk_schema_name: string;
        fk_table_name: string;
        fk_column_name: string;
        pk_schema_name: string;
        pk_table_name: string;
        pk_column_name: string;
      }>(target);

      return rows.map((r) => ({
        from_schema: r.fk_schema_name,
        from_table: r.fk_table_name,
        from_column: r.fk_column_name,
        to_schema: r.pk_schema_name,
        to_table: r.pk_table_name,
        to_column: r.pk_column_name,
        confidence: 'high' as const,
        reason: 'Foreign key constraint',
      }));
    } catch {
      // SHOW IMPORTED KEYS may not be available — return empty
      return [];
    }
  }
}
