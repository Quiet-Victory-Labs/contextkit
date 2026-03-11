import type {
  DataAdapter,
  DataSourceConfig,
  TableInfo,
  ColumnInfo,
  QueryResult,
} from './types.js';
import { MissingDriverError } from './errors.js';

export class BigQueryAdapter implements DataAdapter {
  private client: any;
  private config: DataSourceConfig;

  constructor(config: DataSourceConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    let bq: any;
    try {
      bq = await import('@google-cloud/bigquery');
    } catch {
      throw new MissingDriverError('bigquery');
    }

    const BigQuery = bq.BigQuery ?? bq.default?.BigQuery;
    this.client = new BigQuery({
      projectId: this.config.project,
      keyFilename: this.config.keyFilename,
    });
  }

  async disconnect(): Promise<void> {
    // BigQuery client is stateless; no persistent connection to close
  }

  private async runQuery(sql: string): Promise<any[]> {
    const [rows] = await this.client.query({ query: sql, location: 'US' });
    return rows;
  }

  async listTables(): Promise<TableInfo[]> {
    const dataset = this.config.dataset;
    if (!dataset) throw new Error('BigQuery adapter requires "dataset"');

    const rows = await this.runQuery(`
      SELECT table_name AS name, table_type
      FROM \`${this.config.project}.${dataset}.INFORMATION_SCHEMA.TABLES\`
      ORDER BY table_name
    `);

    // Batch-load table descriptions from TABLE_OPTIONS
    let tableDescriptions = new Map<string, string>();
    try {
      const descRows = await this.runQuery(`
        SELECT table_name, option_value
        FROM \`${this.config.project}.${dataset}.INFORMATION_SCHEMA.TABLE_OPTIONS\`
        WHERE option_name = 'description'
      `);
      tableDescriptions = new Map(
        descRows.map((r: any) => [r.table_name, (r.option_value as string).replace(/^"|"$/g, '')])
      );
    } catch { /* ignore */ }

    // Batch-load partition info
    let partitionKeys = new Map<string, string>();
    try {
      const partRows = await this.runQuery(`
        SELECT table_name, column_name
        FROM \`${this.config.project}.${dataset}.INFORMATION_SCHEMA.COLUMNS\`
        WHERE is_partitioning_column = 'YES'
      `);
      for (const r of partRows) {
        partitionKeys.set(r.table_name, r.column_name);
      }
    } catch { /* ignore */ }

    const tables: TableInfo[] = [];
    for (const row of rows) {
      let rowCount = 0;
      try {
        const countRows = await this.runQuery(
          `SELECT COUNT(*) AS cnt FROM \`${this.config.project}.${dataset}.${row.name}\``
        );
        rowCount = Number(countRows[0]?.cnt ?? 0);
      } catch {
        // skip
      }
      tables.push({
        name: row.name,
        type: (row.table_type as string) === 'VIEW' ? 'view' : 'table',
        schema: dataset,
        row_count: rowCount,
        comment: tableDescriptions.get(row.name),
        partition_key: partitionKeys.get(row.name),
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const dataset = this.config.dataset;
    if (!dataset) throw new Error('BigQuery adapter requires "dataset"');

    const colRows = await this.runQuery(`
      SELECT column_name, data_type, is_nullable, column_default,
             ordinal_position
      FROM \`${this.config.project}.${dataset}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = '${table.replace(/'/g, "''")}'
      ORDER BY ordinal_position
    `);

    // Column descriptions from COLUMN_FIELD_PATHS
    let colDescriptions = new Map<string, string>();
    try {
      const descRows = await this.runQuery(`
        SELECT column_name, description
        FROM \`${this.config.project}.${dataset}.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS\`
        WHERE table_name = '${table.replace(/'/g, "''")}'
          AND description IS NOT NULL AND description != ''
      `);
      colDescriptions = new Map(
        descRows.map((r: any) => [r.column_name, r.description])
      );
    } catch { /* ignore */ }

    // BigQuery supports table constraints (PK, FK) since 2022
    let pkCols = new Set<string>();
    let fkMap = new Map<string, { table: string; column: string }>();
    try {
      const constraintRows = await this.runQuery(`
        SELECT constraint_type, enforced
        FROM \`${this.config.project}.${dataset}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS\`
        WHERE table_name = '${table.replace(/'/g, "''")}'
      `);
      // Check if PK constraint exists
      const hasPK = constraintRows.some((r: any) => r.constraint_type === 'PRIMARY KEY');
      if (hasPK) {
        const pkRows = await this.runQuery(`
          SELECT ccu.column_name
          FROM \`${this.config.project}.${dataset}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS\` tc
          JOIN \`${this.config.project}.${dataset}.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE\` ccu
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_name = '${table.replace(/'/g, "''")}'
            AND tc.constraint_type = 'PRIMARY KEY'
        `);
        pkCols = new Set(pkRows.map((r: any) => r.column_name));
      }
    } catch { /* older BQ or insufficient permissions */ }

    return colRows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
      comment: colDescriptions.get(row.column_name),
      default_value: row.column_default || undefined,
      is_foreign_key: fkMap.has(row.column_name),
      referenced_table: fkMap.get(row.column_name)?.table,
      referenced_column: fkMap.get(row.column_name)?.column,
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const rows = await this.runQuery(sql);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, row_count: rows.length };
  }
}
