import type { DataAdapter, TableInfo, ColumnInfo, QueryResult } from './types.js';

export class SQLiteAdapter implements DataAdapter {
  private db: any;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<void> {
    let Database: any;
    try {
      const mod = await import('better-sqlite3');
      Database = mod.default ?? mod;
    } catch {
      throw new Error(
        'SQLite driver not found. Install it with: npm install better-sqlite3'
      );
    }
    this.db = new Database(this.dbPath, { readonly: true });
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }

  async listTables(): Promise<TableInfo[]> {
    const rows = this.db
      .prepare(
        `SELECT name, type FROM sqlite_master
         WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      )
      .all();

    const tables: TableInfo[] = [];
    for (const row of rows) {
      let rowCount = 0;
      try {
        const countRow = this.db
          .prepare(`SELECT COUNT(*) AS cnt FROM "${row.name}"`)
          .get();
        rowCount = Number(countRow?.cnt ?? 0);
      } catch {
        // view or inaccessible table
      }
      tables.push({
        name: row.name,
        type: row.type === 'view' ? 'view' : 'table',
        schema: 'main',
        row_count: rowCount,
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const cols = this.db.prepare(`PRAGMA table_info("${table}")`).all();

    return cols.map((col: any) => ({
      name: col.name,
      data_type: col.type || 'TEXT',
      nullable: col.notnull === 0,
      is_primary_key: col.pk > 0,
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const stmt = this.db.prepare(sql);
    // Detect if statement returns data
    if (stmt.reader) {
      const rows = stmt.all();
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { columns, rows, row_count: rows.length };
    }
    // Non-SELECT statements
    const info = stmt.run();
    return { columns: [], rows: [], row_count: info.changes ?? 0 };
  }
}
