import type {
  DataAdapter,
  DataSourceConfig,
  TableInfo,
  ColumnInfo,
  QueryResult,
  ForeignKeyInfo,
} from './types.js';
import { MissingDriverError } from './errors.js';

export class DatabricksAdapter implements DataAdapter {
  private session: any;
  private client: any;
  private config: DataSourceConfig;

  constructor(config: DataSourceConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    let dbsql: any;
    try {
      dbsql = await import('@databricks/sql');
    } catch {
      throw new MissingDriverError('databricks');
    }

    const DBSQLClient = dbsql.DBSQLClient ?? dbsql.default?.DBSQLClient ?? dbsql.default;
    this.client = new DBSQLClient();

    const connection = await this.client.connect({
      host: this.config.serverHostname,
      path: this.config.httpPath,
      token: this.config.token,
    });

    this.session = await connection.openSession({
      initialCatalog: this.config.database,
      initialSchema: this.config.schema ?? 'default',
    });
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      await this.session.close();
    }
    if (this.client) {
      await this.client.close();
    }
  }

  private async execute(sql: string): Promise<any[]> {
    const operation = await this.session.executeStatement(sql);
    const result = await operation.fetchAll();
    await operation.close();
    return result;
  }

  async listTables(): Promise<TableInfo[]> {
    const schemaName = this.config.schema ?? 'default';
    const rows = await this.execute(`
      SELECT TABLE_NAME AS name, TABLE_TYPE AS table_type, COMMENT AS comment
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
      ORDER BY TABLE_NAME
    `);

    // Batch-load foreign keys (Unity Catalog)
    let tableFKs = new Map<string, ForeignKeyInfo[]>();
    try {
      const fkRows = await this.execute(`
        SELECT
          kcu.TABLE_NAME AS table_name,
          kcu.COLUMN_NAME AS column_name,
          ccu.TABLE_NAME AS referenced_table,
          ccu.COLUMN_NAME AS referenced_column,
          kcu.CONSTRAINT_NAME AS constraint_name
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
          AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
          ON rc.UNIQUE_CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
          AND rc.UNIQUE_CONSTRAINT_SCHEMA = ccu.CONSTRAINT_SCHEMA
        WHERE kcu.TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
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
    } catch { /* Unity Catalog FKs not available */ }

    const tables: TableInfo[] = [];
    for (const row of rows) {
      let rowCount = 0;
      try {
        const countRows = await this.execute(
          `SELECT COUNT(*) AS cnt FROM \`${schemaName}\`.\`${row.name}\``
        );
        rowCount = Number(countRows[0]?.cnt ?? 0);
      } catch {
        // skip
      }
      tables.push({
        name: row.name,
        type: (row.table_type as string) === 'VIEW' ? 'view' : 'table',
        schema: schemaName,
        row_count: rowCount,
        comment: row.comment || undefined,
        foreign_keys: tableFKs.get(row.name),
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const schemaName = this.config.schema ?? 'default';

    const colRows = await this.execute(`
      SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
             IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default,
             COMMENT AS comment,
             CHARACTER_MAXIMUM_LENGTH AS char_max_length,
             NUMERIC_PRECISION AS num_precision,
             NUMERIC_SCALE AS num_scale
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
        AND TABLE_NAME = '${table.replace(/'/g, "''")}'
      ORDER BY ORDINAL_POSITION
    `);

    // PK detection (Unity Catalog)
    let pkCols = new Set<string>();
    try {
      const pkRows = await this.execute(`
        SELECT kcu.COLUMN_NAME AS column_name
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        WHERE tc.TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
          AND tc.TABLE_NAME = '${table.replace(/'/g, "''")}'
          AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      `);
      pkCols = new Set(pkRows.map((r: any) => r.column_name));
    } catch { /* ignore */ }

    // FK lookup
    let fkMap = new Map<string, { table: string; column: string }>();
    try {
      const fkRows = await this.execute(`
        SELECT
          kcu.COLUMN_NAME AS column_name,
          ccu.TABLE_NAME AS referenced_table,
          ccu.COLUMN_NAME AS referenced_column
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
          AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
          ON rc.UNIQUE_CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
          AND rc.UNIQUE_CONSTRAINT_SCHEMA = ccu.CONSTRAINT_SCHEMA
        WHERE kcu.TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
          AND kcu.TABLE_NAME = '${table.replace(/'/g, "''")}'
      `);
      fkMap = new Map(
        fkRows.map((r: any) => [r.column_name, { table: r.referenced_table, column: r.referenced_column }])
      );
    } catch { /* ignore */ }

    return colRows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
      comment: row.comment || undefined,
      default_value: row.column_default || undefined,
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
