import type { DataAdapter, TableInfo, ColumnInfo, QueryResult, ForeignKeyInfo, IndexInfo } from './types.js';
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

    // Batch-load foreign keys
    const fkResult = await this.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'main'
    `).catch(() => ({ rows: [], columns: [], row_count: 0 }));
    const tableFKs = new Map<string, ForeignKeyInfo[]>();
    for (const r of fkResult.rows) {
      const name = r.table_name as string;
      const fks = tableFKs.get(name) ?? [];
      fks.push({
        column: r.column_name as string,
        referenced_table: r.referenced_table as string,
        referenced_column: r.referenced_column as string,
        constraint_name: r.constraint_name as string,
      });
      tableFKs.set(name, fks);
    }

    // Batch-load indexes via duckdb_indexes()
    const idxResult = await this.query(`
      SELECT table_name, index_name, is_unique, sql
      FROM duckdb_indexes()
      WHERE schema_name = 'main'
    `).catch(() => ({ rows: [], columns: [], row_count: 0 }));
    const tableIndexes = new Map<string, IndexInfo[]>();
    for (const r of idxResult.rows) {
      const tbl = r.table_name as string;
      const idxs = tableIndexes.get(tbl) ?? [];
      // Parse column names from index SQL (CREATE INDEX ... ON table(col1, col2))
      const sqlStr = r.sql as string;
      const colMatch = sqlStr?.match(/\(([^)]+)\)\s*$/);
      const columns = colMatch ? colMatch[1]!.split(',').map(c => c.trim().replace(/"/g, '')) : [];
      idxs.push({
        name: r.index_name as string,
        columns,
        is_unique: r.is_unique as boolean,
      });
      tableIndexes.set(tbl, idxs);
    }

    const tables: TableInfo[] = [];
    for (const row of tablesResult.rows) {
      const name = row.name as string;
      const isView = (row.table_type as string) === 'VIEW';
      let rowCount = 0;
      try {
        const countResult = await this.query(`SELECT COUNT(*) AS cnt FROM "${name.replace(/"/g, '""')}"`);
        rowCount = Number(countResult.rows[0]?.cnt ?? 0);
      } catch {
        // view or inaccessible table
      }
      tables.push({
        name,
        type: isView ? 'view' : 'table',
        schema: 'main',
        row_count: rowCount,
        foreign_keys: tableFKs.get(name),
        indexes: tableIndexes.get(name),
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const escapedTable = table.replace(/'/g, "''");
    const colResult = await this.query(`
      SELECT column_name, data_type, is_nullable, column_default,
             character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = '${escapedTable}' AND table_schema = 'main'
      ORDER BY ordinal_position
    `);

    // Get primary key columns
    const pkResult = await this.query(`
      SELECT column_name
      FROM information_schema.key_column_usage
      WHERE table_name = '${escapedTable}' AND table_schema = 'main'
        AND constraint_name LIKE '%_pkey'
    `).catch(() => ({ rows: [], columns: [], row_count: 0 }));
    const pkCols = new Set(pkResult.rows.map((r) => r.column_name as string));

    // Unique columns
    const uniqueResult = await this.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = '${escapedTable}' AND tc.table_schema = 'main'
        AND tc.constraint_type = 'UNIQUE'
    `).catch(() => ({ rows: [], columns: [], row_count: 0 }));
    const uniqueCols = new Set(uniqueResult.rows.map((r) => r.column_name as string));

    // FK lookup
    const fkResult = await this.query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = '${escapedTable}' AND tc.table_schema = 'main'
    `).catch(() => ({ rows: [], columns: [], row_count: 0 }));
    const fkMap = new Map(
      fkResult.rows.map((r) => [r.column_name as string, { table: r.referenced_table as string, column: r.referenced_column as string }])
    );

    return colResult.rows.map((row) => ({
      name: row.column_name as string,
      data_type: row.data_type as string,
      nullable: (row.is_nullable as string) === 'YES',
      is_primary_key: pkCols.has(row.column_name as string),
      default_value: (row.column_default as string) || undefined,
      is_unique: uniqueCols.has(row.column_name as string),
      is_foreign_key: fkMap.has(row.column_name as string),
      referenced_table: fkMap.get(row.column_name as string)?.table,
      referenced_column: fkMap.get(row.column_name as string)?.column,
      character_maximum_length: (row.character_maximum_length as number) ?? undefined,
      numeric_precision: (row.numeric_precision as number) ?? undefined,
      numeric_scale: (row.numeric_scale as number) ?? undefined,
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
