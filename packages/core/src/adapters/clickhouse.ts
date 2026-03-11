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
      SELECT name, engine, total_rows, comment, partition_key, sorting_key
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
      comment: row.comment || undefined,
      partition_key: row.partition_key || undefined,
    }));
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const dbName = this.config.database ?? 'default';

    const colRows = await this.runQuery(`
      SELECT name AS column_name, type AS data_type, position,
             comment, default_kind, default_expression,
             numeric_precision, numeric_scale
      FROM system.columns
      WHERE database = '${dbName.replace(/'/g, "''")}'
        AND table = '${table.replace(/'/g, "''")}'
      ORDER BY position
    `);

    // ClickHouse uses ORDER BY keys instead of traditional PKs
    let orderByCols = new Set<string>();
    let primaryKeyCols = new Set<string>();
    try {
      const tableRows = await this.runQuery(`
        SELECT sorting_key, primary_key
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
      if (tableRows[0]?.primary_key) {
        const keys = (tableRows[0].primary_key as string)
          .split(',')
          .map((k: string) => k.trim());
        primaryKeyCols = new Set(keys);
      }
    } catch {
      // ignore
    }

    return colRows.map((row: any) => {
      const dataType = row.data_type as string;

      // Parse Enum values from type like "Enum8('a' = 1, 'b' = 2)"
      let enumValues: string[] | undefined;
      const enumMatch = dataType.match(/^Enum(?:8|16)\((.+)\)$/);
      if (enumMatch) {
        enumValues = enumMatch[1]!
          .split(',')
          .map((v: string) => v.trim().replace(/^'|'\s*=\s*\d+$/g, '').trim())
          .filter(Boolean);
      }

      return {
        name: row.column_name,
        data_type: dataType,
        nullable: dataType.startsWith('Nullable'),
        is_primary_key: primaryKeyCols.has(row.column_name) || orderByCols.has(row.column_name),
        comment: row.comment || undefined,
        default_value: row.default_expression || undefined,
        enum_values: enumValues,
        numeric_precision: row.numeric_precision ?? undefined,
        numeric_scale: row.numeric_scale ?? undefined,
      };
    });
  }

  async query(sql: string): Promise<QueryResult> {
    const rows = await this.runQuery(sql);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, row_count: rows.length };
  }
}
