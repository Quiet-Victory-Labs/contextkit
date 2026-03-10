import type {
  DataAdapter,
  DataSourceConfig,
  TableInfo,
  ColumnInfo,
  QueryResult,
} from './types.js';
import { MissingDriverError } from './errors.js';

export class ClickHouseAdapter implements DataAdapter {
  private client: any;
  private config: DataSourceConfig;

  constructor(config: DataSourceConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    let ch: any;
    try {
      ch = await import('@clickhouse/client');
    } catch {
      throw new MissingDriverError('clickhouse');
    }

    const createClient = ch.createClient ?? ch.default?.createClient;
    this.client = createClient({
      host: this.config.host ?? 'http://localhost:8123',
      ...(this.config.port ? { port: this.config.port } : {}),
      database: this.config.database ?? 'default',
      username: this.config.username,
      password: this.config.password,
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }

  private async runQuery(sql: string): Promise<any[]> {
    const result = await this.client.query({ query: sql, format: 'JSONEachRow' });
    return result.json();
  }

  async listTables(): Promise<TableInfo[]> {
    const dbName = this.config.database ?? 'default';
    const rows = await this.runQuery(`
      SELECT name, engine, total_rows
      FROM system.tables
      WHERE database = '${dbName.replace(/'/g, "''")}'
        AND name NOT LIKE '.%'
      ORDER BY name
    `);

    return rows.map((row: any) => ({
      name: row.name,
      type: (row.engine as string)?.includes('View') ? 'view' as const : 'table' as const,
      schema: dbName,
      row_count: Number(row.total_rows ?? 0),
    }));
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const dbName = this.config.database ?? 'default';

    const colRows = await this.runQuery(`
      SELECT name AS column_name, type AS data_type, position
      FROM system.columns
      WHERE database = '${dbName.replace(/'/g, "''")}'
        AND table = '${table.replace(/'/g, "''")}'
      ORDER BY position
    `);

    // ClickHouse uses ORDER BY keys instead of traditional PKs
    let orderByCols = new Set<string>();
    try {
      const tableRows = await this.runQuery(`
        SELECT sorting_key
        FROM system.tables
        WHERE database = '${dbName.replace(/'/g, "''")}'
          AND name = '${table.replace(/'/g, "''")}'
      `);
      if (tableRows[0]?.sorting_key) {
        const keys = (tableRows[0].sorting_key as string)
          .split(',')
          .map((k: string) => k.trim());
        orderByCols = new Set(keys);
      }
    } catch {
      // ignore
    }

    return colRows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: (row.data_type as string).startsWith('Nullable'),
      is_primary_key: orderByCols.has(row.column_name),
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const rows = await this.runQuery(sql);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, row_count: rows.length };
  }
}
