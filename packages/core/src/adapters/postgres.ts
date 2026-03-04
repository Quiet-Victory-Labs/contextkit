import type { DataAdapter, TableInfo, ColumnInfo, QueryResult } from './types.js';

export class PostgresAdapter implements DataAdapter {
  private client: any;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    const pg = await import('pg');
    this.client = new pg.default.Client({ connectionString: this.connectionString });
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
    }
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.client.query(`
      SELECT t.table_name AS name, t.table_type
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
      ORDER BY t.table_name
    `);

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      let rowCount = 0;
      try {
        const countRes = await this.client.query(`SELECT COUNT(*) AS cnt FROM "${row.name}"`);
        rowCount = Number(countRes.rows[0]?.cnt ?? 0);
      } catch {
        // skip
      }
      tables.push({
        name: row.name,
        type: row.table_type === 'VIEW' ? 'view' : 'table',
        schema: 'public',
        row_count: rowCount,
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const colResult = await this.client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [table]);

    const pkResult = await this.client.query(`
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `, [table]).catch(() => ({ rows: [] }));

    const pkCols = new Set(pkResult.rows.map((r: any) => r.column_name));

    return colResult.rows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const result = await this.client.query(sql);
    return {
      columns: result.fields?.map((f: any) => f.name) ?? [],
      rows: result.rows ?? [],
      row_count: result.rows?.length ?? 0,
    };
  }
}
