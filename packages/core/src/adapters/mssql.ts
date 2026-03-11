import type { DataAdapter, TableInfo, ColumnInfo, QueryResult, ForeignKeyInfo, IndexInfo, CheckConstraintInfo } from './types.js';
import { MissingDriverError } from './errors.js';

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
      throw new MissingDriverError('mssql');
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

    // Table comments from extended properties
    const commentResult = await this.rawQuery(`
      SELECT t.name AS table_name, ep.value AS comment
      FROM sys.tables t
      JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0
      WHERE ep.name = 'MS_Description'
    `).catch(() => ({ recordset: [] }));
    const tableComments = new Map(
      (commentResult.recordset as any[]).map((r: any) => [r.table_name, r.comment])
    );

    // Batch-load foreign keys
    const fkResult = await this.rawQuery(`
      SELECT
        OBJECT_NAME(fk.parent_object_id) AS table_name,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
        OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column,
        fk.name AS constraint_name
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      ORDER BY table_name, constraint_name
    `).catch(() => ({ recordset: [] }));
    const tableFKs = new Map<string, ForeignKeyInfo[]>();
    for (const r of fkResult.recordset as any[]) {
      const fks = tableFKs.get(r.table_name) ?? [];
      fks.push({
        column: r.column_name,
        referenced_table: r.referenced_table,
        referenced_column: r.referenced_column,
        constraint_name: r.constraint_name,
      });
      tableFKs.set(r.table_name, fks);
    }

    // Batch-load indexes (non-PK)
    const idxResult = await this.rawQuery(`
      SELECT
        OBJECT_NAME(i.object_id) AS table_name,
        i.name AS index_name,
        i.is_unique,
        COL_NAME(ic.object_id, ic.column_id) AS column_name,
        ic.key_ordinal
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      WHERE i.is_primary_key = 0 AND i.type > 0
        AND OBJECT_SCHEMA_NAME(i.object_id) = 'dbo'
      ORDER BY table_name, i.name, ic.key_ordinal
    `).catch(() => ({ recordset: [] }));
    const tableIndexes = new Map<string, IndexInfo[]>();
    const indexAccum = new Map<string, { name: string; columns: string[]; is_unique: boolean; table: string }>();
    for (const r of idxResult.recordset as any[]) {
      const key = `${r.table_name}::${r.index_name}`;
      const existing = indexAccum.get(key);
      if (existing) {
        existing.columns.push(r.column_name);
      } else {
        indexAccum.set(key, {
          name: r.index_name,
          columns: [r.column_name],
          is_unique: r.is_unique,
          table: r.table_name,
        });
      }
    }
    for (const idx of indexAccum.values()) {
      const idxs = tableIndexes.get(idx.table) ?? [];
      idxs.push({ name: idx.name, columns: idx.columns, is_unique: idx.is_unique });
      tableIndexes.set(idx.table, idxs);
    }

    // Batch-load check constraints
    const checkResult = await this.rawQuery(`
      SELECT
        OBJECT_NAME(cc.parent_object_id) AS table_name,
        cc.name AS constraint_name,
        cc.definition AS expression
      FROM sys.check_constraints cc
      WHERE OBJECT_SCHEMA_NAME(cc.parent_object_id) = 'dbo'
    `).catch(() => ({ recordset: [] }));
    const tableChecks = new Map<string, CheckConstraintInfo[]>();
    for (const r of checkResult.recordset as any[]) {
      const checks = tableChecks.get(r.table_name) ?? [];
      checks.push({ name: r.constraint_name, expression: r.expression });
      tableChecks.set(r.table_name, checks);
    }

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
        comment: tableComments.get(row.name),
        foreign_keys: tableFKs.get(row.name),
        indexes: tableIndexes.get(row.name),
        check_constraints: tableChecks.get(row.name),
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const colResult = await this.rawQuery(`
      SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
             IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default,
             CHARACTER_MAXIMUM_LENGTH AS char_max_length,
             NUMERIC_PRECISION AS num_precision,
             NUMERIC_SCALE AS num_scale
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

    // Column comments from extended properties
    const commentResult = await this.rawQuery(`
      SELECT c.name AS column_name, ep.value AS comment
      FROM sys.columns c
      JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id
      WHERE c.object_id = OBJECT_ID('${table.replace(/'/g, "''")}')
        AND ep.name = 'MS_Description'
    `).catch(() => ({ recordset: [] }));
    const colComments = new Map(
      (commentResult.recordset as any[]).map((r: any) => [r.column_name, r.comment])
    );

    // Unique columns (single-column unique indexes, non-PK)
    const uniqueResult = await this.rawQuery(`
      SELECT COL_NAME(ic.object_id, ic.column_id) AS column_name
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      WHERE i.is_unique = 1 AND i.is_primary_key = 0
        AND i.object_id = OBJECT_ID('${table.replace(/'/g, "''")}')
      GROUP BY ic.object_id, i.index_id, COL_NAME(ic.object_id, ic.column_id)
      HAVING COUNT(*) = 1
    `).catch(() => ({ recordset: [] }));
    const uniqueCols = new Set(
      (uniqueResult.recordset as any[]).map((r: any) => r.column_name)
    );

    // FK lookup
    const fkLookup = await this.rawQuery(`
      SELECT
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
        OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      WHERE fk.parent_object_id = OBJECT_ID('${table.replace(/'/g, "''")}')
    `).catch(() => ({ recordset: [] }));
    const fkMap = new Map(
      (fkLookup.recordset as any[]).map((r: any) => [r.column_name, { table: r.referenced_table, column: r.referenced_column }])
    );

    return (colResult.recordset as any[]).map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
      comment: colComments.get(row.column_name),
      default_value: row.column_default || undefined,
      is_unique: uniqueCols.has(row.column_name),
      is_foreign_key: fkMap.has(row.column_name),
      referenced_table: fkMap.get(row.column_name)?.table,
      referenced_column: fkMap.get(row.column_name)?.column,
      character_maximum_length: row.char_max_length ?? undefined,
      numeric_precision: row.num_precision ?? undefined,
      numeric_scale: row.num_scale ?? undefined,
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
