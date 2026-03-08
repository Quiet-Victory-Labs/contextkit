/**
 * BigQuery Connector
 *
 * Read-only database introspection using BigQuery INFORMATION_SCHEMA views.
 * Uses the `@google-cloud/bigquery` library.
 */

import { BaseConnector, ConnectorError } from './base.js';
import type {
  ColumnMeta,
  ConnectorConfig,
  RelationshipCandidate,
  TableMeta,
  TableStats,
} from './types.js';

// ── BigQuery-specific configuration ───────────────────────────────

export interface BigQueryConnectorConfig extends ConnectorConfig {
  /** GCP project ID */
  projectId: string;
  /** Default dataset (optional — used as default schema) */
  defaultDataset?: string;
  /** Path to service account key file (optional if using ADC) */
  keyFilename?: string;
  /** Service account credentials object (alternative to keyFilename) */
  credentials?: {
    client_email: string;
    private_key: string;
    project_id?: string;
  };
}

// ── Connector ─────────────────────────────────────────────────────

export class BigQueryConnector extends BaseConnector {
  private client: any = null;
  private readonly projectId: string;
  private readonly defaultDataset?: string;
  private readonly keyFilename?: string;
  private readonly credentials?: BigQueryConnectorConfig['credentials'];

  constructor(private readonly config: BigQueryConnectorConfig) {
    super(config);
    this.projectId = config.projectId;
    this.defaultDataset = config.defaultDataset;
    this.keyFilename = config.keyFilename;
    this.credentials = config.credentials;
  }

  // ── Connection lifecycle ───────────────────────────────────────

  protected async doConnect(): Promise<void> {
    const { BigQuery } = await import('@google-cloud/bigquery');
    this.client = new BigQuery({
      projectId: this.projectId,
      keyFilename: this.keyFilename,
      credentials: this.credentials,
    });

    // Verify connectivity by listing datasets
    await this.client.getDatasets({ maxResults: 1 });
  }

  protected async doDisconnect(): Promise<void> {
    this.client = null;
  }

  // ── Query helper ───────────────────────────────────────────────

  private async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: Record<string, unknown>,
  ): Promise<T[]> {
    this.assertConnected();
    this.validateSql(sql);

    const options: Record<string, unknown> = {
      query: sql,
      location: undefined,
      params,
      maximumBytesBilled: undefined,
    };

    const [rows] = await this.withTimeout(() => this.client.query(options));
    return rows as T[];
  }

  // ── Introspection methods ──────────────────────────────────────

  async listSchemas(): Promise<string[]> {
    this.assertConnected();
    const [datasets] = await this.withTimeout(() => this.client.getDatasets());
    return (datasets ?? []).map((ds: any) => ds.id as string).sort();
  }

  async listTables(schema?: string): Promise<TableMeta[]> {
    const datasets = schema ? [schema] : await this.listSchemas();
    const tables: TableMeta[] = [];

    for (const dataset of datasets) {
      const sql = `
        SELECT
          table_schema,
          table_name,
          table_type,
          CAST(row_count AS INT64) AS row_count
        FROM \`${this.projectId}.${dataset}.INFORMATION_SCHEMA.TABLES\`
        ORDER BY table_name`;

      const rows = await this.query<{
        table_schema: string;
        table_name: string;
        table_type: string;
        row_count: number | null;
      }>(sql);

      for (const r of rows) {
        tables.push({
          schema: r.table_schema,
          name: r.table_name,
          type: r.table_type === 'VIEW' ? 'view' : 'table',
          row_count_estimate: r.row_count ?? undefined,
        });
      }
    }

    return tables;
  }

  async describeTable(schema: string, table: string): Promise<ColumnMeta[]> {
    const sql = `
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM \`${this.projectId}.${schema}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = @table_name
      ORDER BY ordinal_position`;

    const rows = await this.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(sql, { table_name: table });

    // BigQuery doesn't have traditional primary keys — check for table constraints
    let pkColumns = new Set<string>();
    try {
      const pkSql = `
        SELECT
          ccu.column_name
        FROM \`${this.projectId}.${schema}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS\` tc
        JOIN \`${this.projectId}.${schema}.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE\` ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name      = @table_name
          AND tc.constraint_type = 'PRIMARY KEY'`;

      const pkRows = await this.query<{ column_name: string }>(pkSql, { table_name: table });
      pkColumns = new Set(pkRows.map((r) => r.column_name));
    } catch {
      // Constraints may not be available — ignore
    }

    return rows.map((r) => ({
      name: r.column_name,
      data_type: r.data_type,
      nullable: r.is_nullable === 'YES',
      is_primary_key: pkColumns.has(r.column_name),
    }));
  }

  async getTableStats(schema: string, table: string): Promise<TableStats> {
    const sql = `
      SELECT
        CAST(row_count AS INT64)     AS row_count,
        CAST(size_bytes AS INT64)    AS size_bytes,
        CAST(TIMESTAMP_MILLIS(last_modified_time) AS STRING) AS last_modified
      FROM \`${this.projectId}.${schema}.__TABLES__\`
      WHERE table_id = @table_id`;

    try {
      const rows = await this.query<{
        row_count: number | null;
        size_bytes: number | null;
        last_modified: string | null;
      }>(sql, { table_id: table });

      if (rows.length > 0) {
        return {
          schema,
          table,
          row_count_estimate: rows[0].row_count ?? 0,
          size_bytes: rows[0].size_bytes ?? undefined,
          last_modified: rows[0].last_modified ?? undefined,
        };
      }
    } catch {
      // __TABLES__ may not be accessible — fall through
    }

    return { schema, table, row_count_estimate: 0 };
  }

  async getViewDefinition(schema: string, view: string): Promise<string | null> {
    const sql = `
      SELECT view_definition
      FROM \`${this.projectId}.${schema}.INFORMATION_SCHEMA.VIEWS\`
      WHERE table_name = @view_name`;

    const rows = await this.query<{ view_definition: string }>(sql, { view_name: view });
    return rows.length > 0 ? rows[0].view_definition : null;
  }

  async detectRelationships(schema?: string): Promise<RelationshipCandidate[]> {
    const datasets = schema ? [schema] : await this.listSchemas();
    const relationships: RelationshipCandidate[] = [];

    for (const dataset of datasets) {
      try {
        const sql = `
          SELECT
            ccu_from.table_schema  AS from_schema,
            ccu_from.table_name    AS from_table,
            ccu_from.column_name   AS from_column,
            ccu_to.table_schema    AS to_schema,
            ccu_to.table_name      AS to_table,
            ccu_to.column_name     AS to_column
          FROM \`${this.projectId}.${dataset}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS\` tc
          JOIN \`${this.projectId}.${dataset}.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE\` ccu_from
            ON tc.constraint_name = ccu_from.constraint_name
          JOIN \`${this.projectId}.${dataset}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE\` kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN \`${this.projectId}.${dataset}.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE\` ccu_to
            ON kcu.constraint_name = ccu_to.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'`;

        const rows = await this.query<{
          from_schema: string;
          from_table: string;
          from_column: string;
          to_schema: string;
          to_table: string;
          to_column: string;
        }>(sql);

        for (const r of rows) {
          relationships.push({
            from_schema: r.from_schema,
            from_table: r.from_table,
            from_column: r.from_column,
            to_schema: r.to_schema,
            to_table: r.to_table,
            to_column: r.to_column,
            confidence: 'high',
            reason: 'Foreign key constraint',
          });
        }
      } catch {
        // Constraint views may not be available for this dataset — skip
      }
    }

    return relationships;
  }
}
