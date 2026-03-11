import type { DataAdapter, TableInfo, ColumnInfo, QueryResult, ForeignKeyInfo, IndexInfo, CheckConstraintInfo } from './types.js';
import { MissingDriverError } from './errors.js';

export class PostgresAdapter implements DataAdapter {
  private client: any;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    let pg: any;
    try {
      pg = await import('pg');
    } catch {
      throw new MissingDriverError('postgres');
    }
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

    // Batch-load table comments
    const commentResult = await this.client.query(`
      SELECT c.relname AS table_name, obj_description(c.oid) AS comment
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
    `).catch(() => ({ rows: [] }));
    const tableComments = new Map<string, string>(
      commentResult.rows.map((r: any) => [r.table_name, r.comment])
    );

    // Batch-load foreign keys
    const fkResult = await this.client.query(`
      SELECT
        cl.relname AS table_name,
        a.attname AS column_name,
        cf.relname AS referenced_table,
        af.attname AS referenced_column,
        con.conname AS constraint_name
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_class cf ON cf.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(num, ord)
      CROSS JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS fk(num, ord)
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.num
      JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = fk.num
      WHERE con.contype = 'f' AND n.nspname = 'public' AND k.ord = fk.ord
      ORDER BY cl.relname, con.conname
    `).catch(() => ({ rows: [] }));
    const tableFKs = new Map<string, ForeignKeyInfo[]>();
    for (const r of fkResult.rows) {
      const fks = tableFKs.get(r.table_name) ?? [];
      fks.push({
        column: r.column_name,
        referenced_table: r.referenced_table,
        referenced_column: r.referenced_column,
        constraint_name: r.constraint_name,
      });
      tableFKs.set(r.table_name, fks);
    }

    // Batch-load indexes
    const idxResult = await this.client.query(`
      SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        ix.indisunique AS is_unique,
        array_agg(a.attname ORDER BY k.ord) AS columns
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(num, ord)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.num
      WHERE n.nspname = 'public' AND NOT ix.indisprimary
      GROUP BY t.relname, i.relname, ix.indisunique
      ORDER BY t.relname, i.relname
    `).catch(() => ({ rows: [] }));
    const tableIndexes = new Map<string, IndexInfo[]>();
    for (const r of idxResult.rows) {
      const idxs = tableIndexes.get(r.table_name) ?? [];
      idxs.push({
        name: r.index_name,
        columns: r.columns,
        is_unique: r.is_unique,
      });
      tableIndexes.set(r.table_name, idxs);
    }

    // Batch-load check constraints
    const checkResult = await this.client.query(`
      SELECT
        cl.relname AS table_name,
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS expression
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE con.contype = 'c' AND n.nspname = 'public'
      ORDER BY cl.relname, con.conname
    `).catch(() => ({ rows: [] }));
    const tableChecks = new Map<string, CheckConstraintInfo[]>();
    for (const r of checkResult.rows) {
      const checks = tableChecks.get(r.table_name) ?? [];
      checks.push({ name: r.constraint_name, expression: r.expression });
      tableChecks.set(r.table_name, checks);
    }

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
        comment: tableComments.get(row.name) || undefined,
        foreign_keys: tableFKs.get(row.name),
        indexes: tableIndexes.get(row.name),
        check_constraints: tableChecks.get(row.name),
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const colResult = await this.client.query(`
      SELECT column_name, data_type, is_nullable, column_default,
             character_maximum_length, numeric_precision, numeric_scale,
             udt_name
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

    // Column comments
    const commentResult = await this.client.query(`
      SELECT a.attname AS column_name, d.description AS comment
      FROM pg_description d
      JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
      JOIN pg_class c ON c.oid = d.objoid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = $1 AND n.nspname = 'public' AND d.objsubid > 0
    `, [table]).catch(() => ({ rows: [] }));
    const colComments = new Map(
      commentResult.rows.map((r: any) => [r.column_name, r.comment])
    );

    // Unique constraints (non-PK)
    const uniqueResult = await this.client.query(`
      SELECT a.attname AS column_name
      FROM pg_index ix
      JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
      WHERE ix.indrelid = $1::regclass AND ix.indisunique AND NOT ix.indisprimary
        AND array_length(ix.indkey, 1) = 1
    `, [table]).catch(() => ({ rows: [] }));
    const uniqueCols = new Set(uniqueResult.rows.map((r: any) => r.column_name));

    // Enum values for enum columns
    const enumResult = await this.client.query(`
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      ORDER BY t.typname, e.enumsortorder
    `).catch(() => ({ rows: [] }));
    const enumMap = new Map<string, string[]>();
    for (const r of enumResult.rows) {
      const vals = enumMap.get(r.enum_name) ?? [];
      vals.push(r.enum_value);
      enumMap.set(r.enum_name, vals);
    }

    // FK lookup for this table
    const fkResult = await this.client.query(`
      SELECT
        a.attname AS column_name,
        cf.relname AS referenced_table,
        af.attname AS referenced_column
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_class cf ON cf.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(num, ord)
      CROSS JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS fk(num, ord)
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.num
      JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = fk.num
      WHERE con.contype = 'f' AND cl.relname = $1 AND n.nspname = 'public' AND k.ord = fk.ord
    `, [table]).catch(() => ({ rows: [] }));
    const fkMap = new Map<string, { table: string; column: string }>(
      fkResult.rows.map((r: any) => [r.column_name, { table: r.referenced_table, column: r.referenced_column }])
    );

    return colResult.rows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
      comment: colComments.get(row.column_name) || undefined,
      default_value: row.column_default || undefined,
      enum_values: enumMap.get(row.udt_name),
      is_unique: uniqueCols.has(row.column_name),
      is_foreign_key: fkMap.has(row.column_name),
      referenced_table: fkMap.get(row.column_name)?.table,
      referenced_column: fkMap.get(row.column_name)?.column,
      character_maximum_length: row.character_maximum_length ?? undefined,
      numeric_precision: row.numeric_precision ?? undefined,
      numeric_scale: row.numeric_scale ?? undefined,
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
