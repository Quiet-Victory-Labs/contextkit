import type {
  DataAdapter,
  DataSourceConfig,
  TableInfo,
  ColumnInfo,
  QueryResult,
} from './types.js';
import { MissingDriverError } from './errors.js';

export class SnowflakeAdapter implements DataAdapter {
  private connection: any;
  private config: DataSourceConfig;

  constructor(config: DataSourceConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    let snowflake: any;
    try {
      snowflake = await import('snowflake-sdk');
    } catch {
      throw new MissingDriverError('snowflake');
    }

    const sdk = snowflake.default ?? snowflake;

    this.connection = sdk.createConnection({
      account: this.config.account,
      username: this.config.username,
      password: this.config.password,
      warehouse: this.config.warehouse,
      database: this.config.database,
      schema: this.config.schema ?? 'PUBLIC',
      role: this.config.role,
    });

    await new Promise<void>((resolve, reject) => {
      this.connection.connect((err: Error | null) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await new Promise<void>((resolve) => {
        this.connection.destroy(() => resolve());
      });
    }
  }

  private async execute(sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.connection.execute({
        sqlText: sql,
        complete: (err: Error | null, _stmt: any, rows: any[]) => {
          if (err) return reject(err);
          resolve(rows ?? []);
        },
      });
    });
  }

  async listTables(): Promise<TableInfo[]> {
    const schemaName = this.config.schema ?? 'PUBLIC';
    const rows = await this.execute(`
      SELECT TABLE_NAME AS "name", TABLE_TYPE AS "table_type", ROW_COUNT AS "row_count"
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
      ORDER BY TABLE_NAME
    `);

    return rows.map((row: any) => ({
      name: row.name,
      type: (row.table_type as string) === 'VIEW' ? 'view' as const : 'table' as const,
      schema: schemaName,
      row_count: Number(row.row_count ?? 0),
    }));
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const schemaName = this.config.schema ?? 'PUBLIC';
    const colRows = await this.execute(`
      SELECT COLUMN_NAME AS "column_name", DATA_TYPE AS "data_type",
             IS_NULLABLE AS "is_nullable"
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
        AND TABLE_NAME = '${table.replace(/'/g, "''")}'
      ORDER BY ORDINAL_POSITION
    `);

    let pkCols = new Set<string>();
    try {
      const pkRows = await this.execute(
        `SHOW PRIMARY KEYS IN TABLE "${schemaName}"."${table}"`
      );
      pkCols = new Set(pkRows.map((r: any) => r['column_name'] ?? r['COLUMN_NAME']));
    } catch {
      // primary key info not available
    }

    return colRows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const rows = await this.execute(sql);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, row_count: rows.length };
  }
}
