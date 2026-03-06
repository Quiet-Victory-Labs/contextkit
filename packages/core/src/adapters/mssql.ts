import type { DataAdapter, TableInfo, ColumnInfo, QueryResult } from './types.js';

export class MSSQLAdapter implements DataAdapter {
  private pool: any;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    let mssql: any;
    try {
      mssql = await import('mssql');
    } catch {
      throw new Error(
        'MSSQL driver not found. Install it with: npm install mssql'
      );
    }
    this.pool = await (mssql.default ?? mssql).connect(this.connectionString);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
    }
  }

  private async rawQuery(sql: string): Promise<any> {
    const result = await this.pool.request().query(sql);
    return result;
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.rawQuery(`
      SELECT TABLE_NAME AS name, TABLE_TYPE AS table_type
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_CATALOG = DB_NAME()
      ORDER BY TABLE_NAME
    `);

    const tables: TableInfo[] = [];
    for (const row of result.recordset) {
      let rowCount = 0;
      try {
        const countResult = await this.rawQuery(
          `SELECT COUNT(*) AS cnt FROM [${row.name}]`
        );
        rowCount = Number(countResult.recordset[0]?.cnt ?? 0);
      } catch {
        // view or inaccessible table
      }
      tables.push({
        name: row.name,
        type: (row.table_type as string) === 'VIEW' ? 'view' : 'table',
        schema: 'dbo',
        row_count: rowCount,
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const colResult = await this.rawQuery(`
      SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
             IS_NULLABLE AS is_nullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${table.replace(/'/g, "''")}'
        AND TABLE_CATALOG = DB_NAME()
      ORDER BY ORDINAL_POSITION
    `);

    const pkResult = await this.rawQuery(`
      SELECT c.name AS column_name
      FROM sys.index_columns ic
      JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE i.is_primary_key = 1
        AND ic.object_id = OBJECT_ID('${table.replace(/'/g, "''")}')
    `).catch(() => ({ recordset: [] }));

    const pkCols = new Set(
      (pkResult.recordset as any[]).map((r: any) => r.column_name)
    );

    return (colResult.recordset as any[]).map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const result = await this.rawQuery(sql);
    const rows = result.recordset ?? [];
    const columns =
      rows.length > 0
        ? Object.keys(rows[0]).filter((k) => !k.startsWith('__'))
        : [];
    return { columns, rows, row_count: rows.length };
  }
}
