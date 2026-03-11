import type { DataAdapter, TableInfo, ColumnInfo, QueryResult, ForeignKeyInfo, IndexInfo, CheckConstraintInfo } from './types.js';
import { MissingDriverError } from './errors.js';

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
      throw new MissingDriverError('mysql');
    }
    this.pool = await mysql.createPool(this.connectionString);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async listTables(): Promise<TableInfo[]> {
    // Tables with comments
    const [rows] = await this.pool.query(`
      SELECT TABLE_NAME AS name, TABLE_TYPE AS table_type, TABLE_COMMENT AS table_comment
      FROM information_schema.tables
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);

    // Batch-load foreign keys
    const [fkRows] = await this.pool.query(`
      SELECT
        kcu.TABLE_NAME AS table_name,
        kcu.COLUMN_NAME AS column_name,
        kcu.REFERENCED_TABLE_NAME AS referenced_table,
        kcu.REFERENCED_COLUMN_NAME AS referenced_column,
        kcu.CONSTRAINT_NAME AS constraint_name
      FROM information_schema.key_column_usage kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME
    `).catch(() => [[]]);
    const tableFKs = new Map<string, ForeignKeyInfo[]>();
    for (const r of fkRows as any[]) {
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
    const [idxRows] = await this.pool.query(`
      SELECT TABLE_NAME AS table_name, INDEX_NAME AS index_name,
             NON_UNIQUE AS non_unique, COLUMN_NAME AS column_name,
             SEQ_IN_INDEX AS seq
      FROM information_schema.statistics
      WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME != 'PRIMARY'
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `).catch(() => [[]]);
    const tableIndexes = new Map<string, IndexInfo[]>();
    const indexAccum = new Map<string, { name: string; columns: string[]; is_unique: boolean; table: string }>();
    for (const r of idxRows as any[]) {
      const key = `${r.table_name}::${r.index_name}`;
      const existing = indexAccum.get(key);
      if (existing) {
        existing.columns.push(r.column_name);
      } else {
        indexAccum.set(key, {
          name: r.index_name,
          columns: [r.column_name],
          is_unique: r.non_unique === 0,
          table: r.table_name,
        });
      }
    }
    for (const idx of indexAccum.values()) {
      const idxs = tableIndexes.get(idx.table) ?? [];
      idxs.push({ name: idx.name, columns: idx.columns, is_unique: idx.is_unique });
      tableIndexes.set(idx.table, idxs);
    }

    // Batch-load check constraints (MySQL 8+)
    const [checkRows] = await this.pool.query(`
      SELECT tc.TABLE_NAME AS table_name, cc.CONSTRAINT_NAME AS constraint_name,
             cc.CHECK_CLAUSE AS expression
      FROM information_schema.check_constraints cc
      JOIN information_schema.table_constraints tc
        ON tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
        AND tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA
      WHERE cc.CONSTRAINT_SCHEMA = DATABASE()
        AND tc.CONSTRAINT_TYPE = 'CHECK'
    `).catch(() => [[]]);
    const tableChecks = new Map<string, CheckConstraintInfo[]>();
    for (const r of checkRows as any[]) {
      const checks = tableChecks.get(r.table_name) ?? [];
      checks.push({ name: r.constraint_name, expression: r.expression });
      tableChecks.set(r.table_name, checks);
    }

    const tables: TableInfo[] = [];
    for (const row of rows as any[]) {
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
        comment: row.table_comment || undefined,
        foreign_keys: tableFKs.get(row.name),
        indexes: tableIndexes.get(row.name),
        check_constraints: tableChecks.get(row.name),
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const [colRows] = await this.pool.query(
      `
      SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
             COLUMN_TYPE AS column_type,
             IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default,
             COLUMN_COMMENT AS column_comment,
             CHARACTER_MAXIMUM_LENGTH AS char_max_length,
             NUMERIC_PRECISION AS num_precision,
             NUMERIC_SCALE AS num_scale
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

    // Unique columns (single-column unique indexes, non-PK)
    const [uniqueRows] = await this.pool.query(
      `
      SELECT COLUMN_NAME AS column_name
      FROM information_schema.statistics
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        AND NON_UNIQUE = 0 AND INDEX_NAME != 'PRIMARY'
      GROUP BY INDEX_NAME, COLUMN_NAME
      HAVING COUNT(*) = 1
      `,
      [table]
    ).catch(() => [[]]);
    const uniqueCols = new Set((uniqueRows as any[]).map((r: any) => r.column_name));

    // FK lookup
    const [fkRows] = await this.pool.query(
      `
      SELECT COLUMN_NAME AS column_name,
             REFERENCED_TABLE_NAME AS referenced_table,
             REFERENCED_COLUMN_NAME AS referenced_column
      FROM information_schema.key_column_usage
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `,
      [table]
    ).catch(() => [[]]);
    const fkMap = new Map(
      (fkRows as any[]).map((r: any) => [r.column_name, { table: r.referenced_table, column: r.referenced_column }])
    );

    return (colRows as any[]).map((row: any) => {
      // Parse ENUM values from COLUMN_TYPE like "enum('a','b','c')"
      let enumValues: string[] | undefined;
      const colType = row.column_type as string;
      if (colType.startsWith('enum(')) {
        const match = colType.match(/^enum\((.+)\)$/);
        if (match) {
          enumValues = match[1]!.split(',').map((v: string) => v.replace(/^'|'$/g, ''));
        }
      }

      return {
        name: row.column_name,
        data_type: row.data_type,
        nullable: row.is_nullable === 'YES',
        is_primary_key: pkCols.has(row.column_name),
        comment: row.column_comment || undefined,
        default_value: row.column_default ?? undefined,
        enum_values: enumValues,
        is_unique: uniqueCols.has(row.column_name),
        is_foreign_key: fkMap.has(row.column_name),
        referenced_table: fkMap.get(row.column_name)?.table,
        referenced_column: fkMap.get(row.column_name)?.column,
        character_maximum_length: row.char_max_length ?? undefined,
        numeric_precision: row.num_precision ?? undefined,
        numeric_scale: row.num_scale ?? undefined,
      };
    });
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
