import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataAdapter, TableInfo, ColumnInfo, QueryResult } from '@runcontext/core';
import { listSchemas, listTables, describeTable, sampleValues, listRelationships } from '../tools.js';

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

function createMockAdapter(overrides: Partial<DataAdapter> = {}): DataAdapter {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTables: vi.fn().mockResolvedValue([]),
    listColumns: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue({ columns: [], rows: [], row_count: 0 }),
    ...overrides,
  };
}

describe('listSchemas', () => {
  it('queries information_schema and returns schema names', async () => {
    const adapter = createMockAdapter({
      query: vi.fn().mockResolvedValue({
        columns: ['schema_name'],
        rows: [{ schema_name: 'public' }, { schema_name: 'analytics' }],
        row_count: 2,
      }),
    });

    const result = await listSchemas(adapter, 'postgres');
    expect(result.schemas).toEqual(['public', 'analytics']);
    expect(adapter.query).toHaveBeenCalledOnce();
  });

  it('returns empty array when query fails', async () => {
    const adapter = createMockAdapter({
      query: vi.fn().mockRejectedValue(new Error('no information_schema')),
    });

    const result = await listSchemas(adapter, 'duckdb');
    expect(result.schemas).toEqual([]);
  });
});

describe('listTables', () => {
  it('delegates to adapter.listTables()', async () => {
    const tables: TableInfo[] = [
      { name: 'users', type: 'table', schema: 'public', row_count: 100 },
      { name: 'orders', type: 'table', schema: 'public', row_count: 500 },
    ];
    const adapter = createMockAdapter({
      listTables: vi.fn().mockResolvedValue(tables),
    });

    const result = await listTables(adapter);
    expect(result.tables).toEqual(tables);
    expect(adapter.listTables).toHaveBeenCalledOnce();
  });
});

describe('describeTable', () => {
  it('delegates to adapter.listColumns()', async () => {
    const columns: ColumnInfo[] = [
      { name: 'id', data_type: 'integer', nullable: false, is_primary_key: true },
      { name: 'name', data_type: 'varchar', nullable: true, is_primary_key: false },
    ];
    const adapter = createMockAdapter({
      listColumns: vi.fn().mockResolvedValue(columns),
    });

    const result = await describeTable(adapter, 'users');
    expect(result.table).toBe('users');
    expect(result.columns).toEqual(columns);
    expect(adapter.listColumns).toHaveBeenCalledWith('users');
  });
});

describe('sampleValues', () => {
  it('queries with LIMIT and returns rows', async () => {
    const queryResult: QueryResult = {
      columns: ['id', 'name'],
      rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
      row_count: 2,
    };
    const queryFn = vi.fn().mockResolvedValue(queryResult);
    const adapter = createMockAdapter({ query: queryFn });

    const result = await sampleValues(adapter, 'users', 10);
    expect(result.table).toBe('users');
    expect(result.rows).toEqual(queryResult.rows);
    expect(result.row_count).toBe(2);

    // Verify the query includes LIMIT
    const sql = queryFn.mock.calls[0]![0] as string;
    expect(sql).toContain('LIMIT 10');
    expect(sql).toContain('"users"');
  });

  it('caps limit at 100', async () => {
    const queryFn = vi.fn().mockResolvedValue({ columns: [], rows: [], row_count: 0 });
    const adapter = createMockAdapter({ query: queryFn });

    await sampleValues(adapter, 'users', 500);
    const sql = queryFn.mock.calls[0]![0] as string;
    expect(sql).toContain('LIMIT 100');
  });

  it('defaults to 100 when no limit given', async () => {
    const queryFn = vi.fn().mockResolvedValue({ columns: [], rows: [], row_count: 0 });
    const adapter = createMockAdapter({ query: queryFn });

    await sampleValues(adapter, 'users');
    const sql = queryFn.mock.calls[0]![0] as string;
    expect(sql).toContain('LIMIT 100');
  });

  it('handles schema.table format', async () => {
    const queryFn = vi.fn().mockResolvedValue({ columns: [], rows: [], row_count: 0 });
    const adapter = createMockAdapter({ query: queryFn });

    await sampleValues(adapter, 'public.users', 10);
    const sql = queryFn.mock.calls[0]![0] as string;
    expect(sql).toContain('"public"."users"');
  });
});

describe('listRelationships', () => {
  it('queries information_schema for postgres', async () => {
    const adapter = createMockAdapter({
      query: vi.fn().mockResolvedValue({
        columns: ['constraint_name', 'source_table', 'source_column', 'target_table', 'target_column'],
        rows: [
          {
            constraint_name: 'fk_orders_user',
            source_table: 'orders',
            source_column: 'user_id',
            target_table: 'users',
            target_column: 'id',
          },
        ],
        row_count: 1,
      }),
    });

    const result = await listRelationships(adapter, 'postgres');
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]!.source_table).toBe('orders');
    expect(result.relationships[0]!.target_table).toBe('users');
  });

  it('returns empty for bigquery', async () => {
    const adapter = createMockAdapter();
    const result = await listRelationships(adapter, 'bigquery');
    expect(result.relationships).toEqual([]);
  });

  it('returns empty when query fails', async () => {
    const adapter = createMockAdapter({
      query: vi.fn().mockRejectedValue(new Error('not supported')),
    });

    const result = await listRelationships(adapter, 'postgres');
    expect(result.relationships).toEqual([]);
  });
});
