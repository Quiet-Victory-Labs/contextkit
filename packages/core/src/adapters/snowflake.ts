import type {
  DataAdapter,
  DataSourceConfig,
  TableInfo,
  ColumnInfo,
  QueryResult,
  ForeignKeyInfo,
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
      SELECT TABLE_NAME AS "name", TABLE_TYPE AS "table_type",
             ROW_COUNT AS "row_count", COMMENT AS "comment"
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
      ORDER BY TABLE_NAME
    `);

    // Batch-load foreign keys via INFORMATION_SCHEMA
    let tableFKs = new Map<string, ForeignKeyInfo[]>();
    try {
      const fkRows = await this.execute(`
        SELECT
          fk.TABLE_NAME AS "table_name",
          fk.COLUMN_NAME AS "column_name",
          pk.TABLE_NAME AS "referenced_table",
          pk.COLUMN_NAME AS "referenced_column",
          fk.CONSTRAINT_NAME AS "constraint_name"
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk
        JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          ON fk.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
          AND fk.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pk
          ON rc.UNIQUE_CONSTRAINT_NAME = pk.CONSTRAINT_NAME
          AND rc.UNIQUE_CONSTRAINT_SCHEMA = pk.CONSTRAINT_SCHEMA
          AND fk.ORDINAL_POSITION = pk.ORDINAL_POSITION
        WHERE fk.TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
      `);
      for (const r of fkRows) {
        const fks = tableFKs.get(r.table_name) ?? [];
        fks.push({
          column: r.column_name,
          referenced_table: r.referenced_table,
          referenced_column: r.referenced_column,
          constraint_name: r.constraint_name,
        });
        tableFKs.set(r.table_name, fks);
      }
    } catch { /* FK info not available */ }

    return rows.map((row: any) => ({
      name: row.name,
      type: (row.table_type as string) === 'VIEW' ? 'view' as const : 'table' as const,
      schema: schemaName,
      row_count: Number(row.row_count ?? 0),
      comment: row.comment || undefined,
      foreign_keys: tableFKs.get(row.name),
    }));
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const schemaName = this.config.schema ?? 'PUBLIC';
    const colRows = await this.execute(`
      SELECT COLUMN_NAME AS "column_name", DATA_TYPE AS "data_type",
             IS_NULLABLE AS "is_nullable", COLUMN_DEFAULT AS "column_default",
             COMMENT AS "comment",
             CHARACTER_MAXIMUM_LENGTH AS "char_max_length",
             NUMERIC_PRECISION AS "num_precision",
             NUMERIC_SCALE AS "num_scale"
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

    // FK lookup for column-level FK info
    let fkMap = new Map<string, { table: string; column: string }>();
    try {
      const fkRows = await this.execute(`
        SELECT
          fk.COLUMN_NAME AS "column_name",
          pk.TABLE_NAME AS "referenced_table",
          pk.COLUMN_NAME AS "referenced_column"
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk
        JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          ON fk.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
          AND fk.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pk
          ON rc.UNIQUE_CONSTRAINT_NAME = pk.CONSTRAINT_NAME
          AND rc.UNIQUE_CONSTRAINT_SCHEMA = pk.CONSTRAINT_SCHEMA
          AND fk.ORDINAL_POSITION = pk.ORDINAL_POSITION
        WHERE fk.TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
          AND fk.TABLE_NAME = '${table.replace(/'/g, "''")}'
      `);
      fkMap = new Map(
        fkRows.map((r: any) => [r.column_name, { table: r.referenced_table, column: r.referenced_column }])
      );
    } catch { /* ignore */ }

    // Unique constraints
    let uniqueCols = new Set<string>();
    try {
      const uniqueRows = await this.execute(`
        SELECT kcu.COLUMN_NAME AS "column_name"
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        WHERE tc.TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
          AND tc.TABLE_NAME = '${table.replace(/'/g, "''")}'
          AND tc.CONSTRAINT_TYPE = 'UNIQUE'
      `);
      uniqueCols = new Set(uniqueRows.map((r: any) => r.column_name));
    } catch { /* ignore */ }

    return colRows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
      comment: row.comment || undefined,
      default_value: row.column_default || undefined,
      is_unique: uniqueCols.has(row.column_name),
      is_foreign_key: fkMap.has(row.column_name),
      referenced_table: fkMap.get(row.column_name)?.table,
      referenced_column: fkMap.get(row.column_name)?.column,
      character_maximum_length: row.char_max_length ?? undefined,
      numeric_precision: row.num_precision ?? undefined,
      numeric_scale: row.num_scale ?? undefined,
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const rows = await this.execute(sql);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, row_count: rows.length };
  }
}
