import type { DataAdapter, TableInfo, ColumnInfo, QueryResult } from './types.js';
import { MissingDriverError } from './errors.js';

export class DuckDBAdapter implements DataAdapter {
  private db: any;
  private conn: any;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<void> {
    let duckdb: any;
    try {
      duckdb = await import('duckdb');
    } catch {
      throw new MissingDriverError('duckdb');
    }
    const opts = this.dbPath === ':memory:' ? undefined : { access_mode: 'READ_ONLY' } as Record<string, string>;
    return new Promise((resolve, reject) => {
      this.db = new duckdb.default.Database(this.dbPath, opts, (err: Error | null) => {
        if (err) return reject(err);
        this.conn = this.db.connect();
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async listTables(): Promise<TableInfo[]> {
    const tablesResult = await this.query(`
      SELECT table_name AS name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'main'
      ORDER BY table_name
    `);

    const tables: TableInfo[] = [];
    for (const row of tablesResult.rows) {
      const name = row.name as string;
      const isView = (row.table_type as string) === 'VIEW';
      let rowCount = 0;
      try {
        const countResult = await this.query(`SELECT COUNT(*) AS cnt FROM "${name}"`);
        rowCount = Number(countResult.rows[0]?.cnt ?? 0);
      } catch {
        // view or inaccessible table
      }
      tables.push({
        name,
        type: isView ? 'view' : 'table',
        schema: 'main',
        row_count: rowCount,
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const colResult = await this.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${table}' AND table_schema = 'main'
      ORDER BY ordinal_position
    `);

    // Get primary key columns via key_column_usage
    const pkResult = await this.query(`
      SELECT column_name
      FROM information_schema.key_column_usage
      WHERE table_name = '${table}' AND table_schema = 'main'
        AND constraint_name LIKE '%_pkey'
    `).catch(() => ({ rows: [], columns: [], row_count: 0 }));

    const pkCols = new Set(pkResult.rows.map((r) => r.column_name as string));

    return colResult.rows.map((row) => ({
      name: row.column_name as string,
      data_type: row.data_type as string,
      nullable: (row.is_nullable as string) === 'YES',
      is_primary_key: pkCols.has(row.column_name as string),
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, (err: Error | null, rows: Record<string, unknown>[]) => {
        if (err) return reject(err);
        const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
        resolve({ columns, rows, row_count: rows.length });
      });
    });
  }
}
