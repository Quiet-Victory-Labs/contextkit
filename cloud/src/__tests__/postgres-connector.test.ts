import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PostgresConnector } from '../connectors/postgres.js';
import { ConnectionStateError } from '../connectors/base.js';

// ── Mock pg module ────────────────────────────────────────────────

const mockRelease = vi.fn();
const mockQuery = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({ release: mockRelease });
const mockEnd = vi.fn().mockResolvedValue(undefined);

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    query: mockQuery,
    end: mockEnd,
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────

function makeConnector() {
  return new PostgresConnector({
    connection: {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'testuser',
      password: 'testpass',
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────

describe('PostgresConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Connection ──────────────────────────────────────────────

  describe('connection lifecycle', () => {
    it('connects via pg.Pool and verifies with a client', async () => {
      const connector = makeConnector();
      await connector.connect();
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('disconnects by calling pool.end()', async () => {
      const connector = makeConnector();
      await connector.connect();
      await connector.disconnect();
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });

    it('throws ConnectionStateError when querying before connect', async () => {
      const connector = makeConnector();
      await expect(connector.listSchemas()).rejects.toThrow(ConnectionStateError);
    });
  });

  // ── listSchemas ─────────────────────────────────────────────

  describe('listSchemas', () => {
    it('returns schema names from information_schema', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ schema_name: 'public' }, { schema_name: 'app' }],
      });

      const connector = makeConnector();
      await connector.connect();
      const schemas = await connector.listSchemas();

      expect(schemas).toEqual(['public', 'app']);
      expect(mockQuery.mock.calls[0][0]).toContain('information_schema.schemata');
    });
  });

  // ── listTables ──────────────────────────────────────────────

  describe('listTables', () => {
    it('returns tables for a specific schema', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { schema: 'public', name: 'users', type: 'table' },
          { schema: 'public', name: 'user_view', type: 'view' },
        ],
      });

      const connector = makeConnector();
      await connector.connect();
      const tables = await connector.listTables('public');

      expect(tables).toHaveLength(2);
      expect(tables[0]).toEqual({ schema: 'public', name: 'users', type: 'table' });
      expect(tables[1]).toEqual({ schema: 'public', name: 'user_view', type: 'view' });
    });

    it('returns all tables when no schema is specified', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ schema: 'public', name: 'users', type: 'table' }],
      });

      const connector = makeConnector();
      await connector.connect();
      const tables = await connector.listTables();

      expect(tables).toHaveLength(1);
      // Should not pass a schema parameter
      const [sql, params] = mockQuery.mock.calls[0];
      expect(params).toEqual([]);
    });
  });

  // ── describeTable ───────────────────────────────────────────

  describe('describeTable', () => {
    it('returns column metadata with primary key detection', async () => {
      // First query: columns
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'id', data_type: 'integer', nullable: false, default_value: null },
          { name: 'email', data_type: 'text', nullable: false, default_value: null },
          { name: 'bio', data_type: 'text', nullable: true, default_value: null },
        ],
      });
      // Second query: primary keys
      mockQuery.mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
      });

      const connector = makeConnector();
      await connector.connect();
      const columns = await connector.describeTable('public', 'users');

      expect(columns).toHaveLength(3);
      expect(columns[0]).toMatchObject({ name: 'id', is_primary_key: true, nullable: false });
      expect(columns[1]).toMatchObject({ name: 'email', is_primary_key: false });
      expect(columns[2]).toMatchObject({ name: 'bio', nullable: true });
    });
  });

  // ── getTableStats ───────────────────────────────────────────

  describe('getTableStats', () => {
    it('returns row count and size from pg_class', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ row_count_estimate: '1500', size_bytes: '65536' }],
      });

      const connector = makeConnector();
      await connector.connect();
      const stats = await connector.getTableStats('public', 'users');

      expect(stats).toEqual({
        schema: 'public',
        table: 'users',
        row_count_estimate: 1500,
        size_bytes: 65536,
      });
    });

    it('returns zero estimate on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('permission denied'));

      const connector = makeConnector();
      await connector.connect();
      const stats = await connector.getTableStats('public', 'users');

      expect(stats.row_count_estimate).toBe(0);
    });
  });

  // ── getViewDefinition ───────────────────────────────────────

  describe('getViewDefinition', () => {
    it('returns the view SQL', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ view_definition: 'SELECT id, name FROM users' }],
      });

      const connector = makeConnector();
      await connector.connect();
      const def = await connector.getViewDefinition('public', 'user_view');

      expect(def).toBe('SELECT id, name FROM users');
    });

    it('returns null for non-existent view', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const connector = makeConnector();
      await connector.connect();
      const def = await connector.getViewDefinition('public', 'missing');

      expect(def).toBeNull();
    });
  });

  // ── detectRelationships ─────────────────────────────────────

  describe('detectRelationships', () => {
    it('returns foreign key relationships', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            from_schema: 'public',
            from_table: 'orders',
            from_column: 'user_id',
            to_schema: 'public',
            to_table: 'users',
            to_column: 'id',
          },
        ],
      });

      const connector = makeConnector();
      await connector.connect();
      const rels = await connector.detectRelationships('public');

      expect(rels).toHaveLength(1);
      expect(rels[0]).toMatchObject({
        from_table: 'orders',
        from_column: 'user_id',
        to_table: 'users',
        to_column: 'id',
        confidence: 'high',
      });
    });
  });
});
