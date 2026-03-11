import type { DataAdapter, TableInfo, ColumnInfo, QueryResult, ForeignKeyInfo, IndexInfo } from './types.js';
import { MissingDriverError } from './errors.js';

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
      throw new MissingDriverError('sqlite');
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
        `SELECT name, type, sql FROM sqlite_master
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

      // Foreign keys
      let foreignKeys: ForeignKeyInfo[] | undefined;
      try {
        const fkRows = this.db.prepare(`PRAGMA foreign_key_list("${row.name}")`).all();
        if (fkRows.length > 0) {
          foreignKeys = fkRows.map((fk: any) => ({
            column: fk.from,
            referenced_table: fk.table,
            referenced_column: fk.to,
          }));
        }
      } catch { /* ignore */ }

      // Indexes
      let indexes: IndexInfo[] | undefined;
      try {
        const idxRows = this.db.prepare(`PRAGMA index_list("${row.name}")`).all();
        const idxList: IndexInfo[] = [];
        for (const idx of idxRows) {
          if (idx.origin === 'pk') continue; // skip PK indexes
          const idxInfo = this.db.prepare(`PRAGMA index_info("${idx.name}")`).all();
          idxList.push({
            name: idx.name,
            columns: idxInfo.map((c: any) => c.name),
            is_unique: idx.unique === 1,
          });
        }
        if (idxList.length > 0) indexes = idxList;
      } catch { /* ignore */ }

      // Parse CHECK constraints from CREATE TABLE SQL
      let checkConstraints: { name: string; expression: string }[] | undefined;
      if (row.sql && row.type === 'table') {
        const checkMatches = (row.sql as string).matchAll(/CHECK\s*\(([^)]+)\)/gi);
        const checks = [];
        let i = 0;
        for (const m of checkMatches) {
          checks.push({ name: `check_${i++}`, expression: m[1]! });
        }
        if (checks.length > 0) checkConstraints = checks;
      }

      tables.push({
        name: row.name,
        type: row.type === 'view' ? 'view' : 'table',
        schema: 'main',
        row_count: rowCount,
        foreign_keys: foreignKeys,
        indexes,
        check_constraints: checkConstraints,
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const cols = this.db.prepare(`PRAGMA table_info("${table}")`).all();

    // Foreign key lookup for column-level FK info
    const fkRows = this.db.prepare(`PRAGMA foreign_key_list("${table}")`).all();
    const fkMap = new Map<string, { table: string; column: string }>(
      fkRows.map((fk: any) => [fk.from, { table: fk.table, column: fk.to }])
    );

    // Unique columns from indexes
    const idxRows = this.db.prepare(`PRAGMA index_list("${table}")`).all();
    const uniqueCols = new Set<string>();
    for (const idx of idxRows) {
      if (idx.unique !== 1 || idx.origin === 'pk') continue;
      const idxInfo = this.db.prepare(`PRAGMA index_info("${idx.name}")`).all();
      if (idxInfo.length === 1) {
        uniqueCols.add(idxInfo[0].name);
      }
    }

    return cols.map((col: any) => ({
      name: col.name,
      data_type: col.type || 'TEXT',
      nullable: col.notnull === 0,
      is_primary_key: col.pk > 0,
      default_value: col.dflt_value ?? undefined,
      is_unique: uniqueCols.has(col.name),
      is_foreign_key: fkMap.has(col.name),
      referenced_table: fkMap.get(col.name)?.table,
      referenced_column: fkMap.get(col.name)?.column,
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
