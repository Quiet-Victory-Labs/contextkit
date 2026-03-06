import type {
  DataAdapter,
  DataSourceConfig,
  TableInfo,
  ColumnInfo,
  QueryResult,
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
      SELECT TABLE_NAME AS name, TABLE_TYPE AS table_type
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
      ORDER BY TABLE_NAME
    `);

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
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const schemaName = this.config.schema ?? 'default';

    const colRows = await this.execute(`
      SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
             IS_NULLABLE AS is_nullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schemaName.replace(/'/g, "''")}'
        AND TABLE_NAME = '${table.replace(/'/g, "''")}'
      ORDER BY ORDINAL_POSITION
    `);

    // Databricks does not expose traditional PK metadata easily; skip PK detection
    return colRows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: false,
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const rows = await this.execute(sql);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, row_count: rows.length };
  }
}
