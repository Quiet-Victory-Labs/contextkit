import type { DataAdapter, TableInfo, ColumnInfo, QueryResult } from './types.js';

export class MySQLAdapter implements DataAdapter {
  private pool: any;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    let mysql: any;
    try {
      mysql = await import('mysql2/promise');
    } catch {
      throw new Error(
        'MySQL driver not found. Install it with: npm install mysql2'
      );
    }
    this.pool = await mysql.createPool(this.connectionString);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async listTables(): Promise<TableInfo[]> {
    const [rows] = await this.pool.query(`
      SELECT TABLE_NAME AS name, TABLE_TYPE AS table_type
      FROM information_schema.tables
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);

    const tables: TableInfo[] = [];
    for (const row of rows) {
      let rowCount = 0;
      try {
        const [countRows] = await this.pool.query(
          `SELECT COUNT(*) AS cnt FROM \`${row.name}\``
        );
        rowCount = Number(countRows[0]?.cnt ?? 0);
      } catch {
        // view or inaccessible table
      }
      tables.push({
        name: row.name,
        type: (row.table_type as string) === 'VIEW' ? 'view' : 'table',
        schema: undefined,
        row_count: rowCount,
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const [colRows] = await this.pool.query(
      `
      SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
             IS_NULLABLE AS is_nullable
      FROM information_schema.columns
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
      `,
      [table]
    );

    const [pkRows] = await this.pool
      .query(
        `
        SELECT COLUMN_NAME AS column_name
        FROM information_schema.key_column_usage
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME = 'PRIMARY'
        `,
        [table]
      )
      .catch(() => [[]]);

    const pkCols = new Set((pkRows as any[]).map((r: any) => r.column_name));

    return (colRows as any[]).map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const [rows, fields] = await this.pool.query(sql);
    const resultRows = Array.isArray(rows) ? rows : [];
    const columns = fields
      ? (fields as any[]).map((f: any) => f.name)
      : resultRows.length > 0
        ? Object.keys(resultRows[0])
        : [];
    return { columns, rows: resultRows, row_count: resultRows.length };
  }
}
