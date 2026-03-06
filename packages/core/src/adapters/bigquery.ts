import type {
  DataAdapter,
  DataSourceConfig,
  TableInfo,
  ColumnInfo,
  QueryResult,
} from './types.js';

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
      throw new Error(
        'BigQuery driver not found. Install it with: npm install @google-cloud/bigquery'
      );
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
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const dataset = this.config.dataset;
    if (!dataset) throw new Error('BigQuery adapter requires "dataset"');

    const colRows = await this.runQuery(`
      SELECT column_name, data_type, is_nullable
      FROM \`${this.config.project}.${dataset}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = '${table.replace(/'/g, "\\'")}'
      ORDER BY ordinal_position
    `);

    // BigQuery has no native primary key concept
    return colRows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: false,
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const rows = await this.runQuery(sql);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, row_count: rows.length };
  }
}
