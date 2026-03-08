import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BigQueryConnector } from '../connectors/bigquery.js';
import { ConnectionStateError } from '../connectors/base.js';

// ── Mock @google-cloud/bigquery ───────────────────────────────────

const mockQuery = vi.fn();
const mockGetDatasets = vi.fn().mockResolvedValue([[{ id: 'dataset1' }, { id: 'dataset2' }]]);

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    getDatasets: mockGetDatasets,
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────

function makeConnector() {
  return new BigQueryConnector({
    projectId: 'test-project',
    credentials: {
      client_email: 'test@test.iam.gserviceaccount.com',
      private_key: 'fake-key',
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────

describe('BigQueryConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default getDatasets mock
    mockGetDatasets.mockResolvedValue([[{ id: 'dataset1' }, { id: 'dataset2' }]]);
  });

  // ── Connection ──────────────────────────────────────────────

  describe('connection lifecycle', () => {
    it('connects and verifies with getDatasets', async () => {
      const connector = makeConnector();
      await connector.connect();
      expect(mockGetDatasets).toHaveBeenCalledTimes(1);
    });

    it('disconnects cleanly', async () => {
      const connector = makeConnector();
      await connector.connect();
      await connector.disconnect();
      // No error expected
    });

    it('throws ConnectionStateError when querying before connect', async () => {
      const connector = makeConnector();
      await expect(connector.listSchemas()).rejects.toThrow(ConnectionStateError);
    });
  });

  // ── listSchemas ─────────────────────────────────────────────

  describe('listSchemas', () => {
    it('returns dataset IDs as schema names', async () => {
      // First call consumed by connect(), second by listSchemas()
      mockGetDatasets
        .mockResolvedValueOnce([[{ id: 'analytics' }, { id: 'raw' }]])
        .mockResolvedValueOnce([[{ id: 'analytics' }, { id: 'raw' }]]);

      const connector = makeConnector();
      await connector.connect();
      const schemas = await connector.listSchemas();

      expect(schemas).toEqual(['analytics', 'raw']);
    });
  });

  // ── listTables ──────────────────────────────────────────────

  describe('listTables', () => {
    it('returns tables for a specific dataset', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          { table_schema: 'analytics', table_name: 'events', table_type: 'BASE TABLE', row_count: 1000 },
          { table_schema: 'analytics', table_name: 'event_summary', table_type: 'VIEW', row_count: null },
        ],
      ]);

      const connector = makeConnector();
      await connector.connect();
      const tables = await connector.listTables('analytics');

      expect(tables).toHaveLength(2);
      expect(tables[0]).toMatchObject({ schema: 'analytics', name: 'events', type: 'table' });
      expect(tables[1]).toMatchObject({ schema: 'analytics', name: 'event_summary', type: 'view' });
    });

    it('queries all datasets when no schema is specified', async () => {
      // First getDatasets call consumed by connect()
      mockGetDatasets.mockResolvedValueOnce([[{ id: 'ds1' }]]);
      // Second getDatasets call from listSchemas() inside listTables()
      mockGetDatasets.mockResolvedValueOnce([[{ id: 'ds1' }]]);
      // Query for ds1 tables
      mockQuery.mockResolvedValueOnce([
        [{ table_schema: 'ds1', table_name: 't1', table_type: 'BASE TABLE', row_count: 10 }],
      ]);

      const connector = makeConnector();
      await connector.connect();
      const tables = await connector.listTables();

      expect(tables).toHaveLength(1);
      expect(tables[0].schema).toBe('ds1');
    });
  });

  // ── describeTable ───────────────────────────────────────────

  describe('describeTable', () => {
    it('returns column metadata', async () => {
      // Columns query
      mockQuery.mockResolvedValueOnce([
        [
          { column_name: 'id', data_type: 'INT64', is_nullable: 'NO' },
          { column_name: 'name', data_type: 'STRING', is_nullable: 'YES' },
        ],
      ]);
      // Primary key query
      mockQuery.mockResolvedValueOnce([[{ column_name: 'id' }]]);

      const connector = makeConnector();
      await connector.connect();
      const columns = await connector.describeTable('analytics', 'events');

      expect(columns).toHaveLength(2);
      expect(columns[0]).toMatchObject({ name: 'id', is_primary_key: true, nullable: false });
      expect(columns[1]).toMatchObject({ name: 'name', is_primary_key: false, nullable: true });
    });

    it('handles missing constraint views gracefully', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ column_name: 'id', data_type: 'INT64', is_nullable: 'NO' }],
      ]);
      // PK query fails
      mockQuery.mockRejectedValueOnce(new Error('Not found'));

      const connector = makeConnector();
      await connector.connect();
      const columns = await connector.describeTable('analytics', 'events');

      expect(columns).toHaveLength(1);
      expect(columns[0].is_primary_key).toBe(false);
    });
  });

  // ── getTableStats ───────────────────────────────────────────

  describe('getTableStats', () => {
    it('returns stats from __TABLES__', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ row_count: 5000, size_bytes: 131072, last_modified: '2025-06-01T00:00:00Z' }],
      ]);

      const connector = makeConnector();
      await connector.connect();
      const stats = await connector.getTableStats('analytics', 'events');

      expect(stats).toEqual({
        schema: 'analytics',
        table: 'events',
        row_count_estimate: 5000,
        size_bytes: 131072,
        last_modified: '2025-06-01T00:00:00Z',
      });
    });

    it('returns zero on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('__TABLES__ not found'));

      const connector = makeConnector();
      await connector.connect();
      const stats = await connector.getTableStats('analytics', 'events');

      expect(stats.row_count_estimate).toBe(0);
    });
  });

  // ── getViewDefinition ───────────────────────────────────────

  describe('getViewDefinition', () => {
    it('returns the view SQL', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ view_definition: 'SELECT id, name FROM `test-project.analytics.events`' }],
      ]);

      const connector = makeConnector();
      await connector.connect();
      const def = await connector.getViewDefinition('analytics', 'event_summary');

      expect(def).toBe('SELECT id, name FROM `test-project.analytics.events`');
    });

    it('returns null for non-existent view', async () => {
      mockQuery.mockResolvedValueOnce([[]]);

      const connector = makeConnector();
      await connector.connect();
      const def = await connector.getViewDefinition('analytics', 'missing');

      expect(def).toBeNull();
    });
  });

  // ── detectRelationships ─────────────────────────────────────

  describe('detectRelationships', () => {
    it('returns foreign key relationships', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          {
            from_schema: 'analytics',
            from_table: 'orders',
            from_column: 'user_id',
            to_schema: 'analytics',
            to_table: 'users',
            to_column: 'id',
          },
        ],
      ]);

      const connector = makeConnector();
      await connector.connect();
      const rels = await connector.detectRelationships('analytics');

      expect(rels).toHaveLength(1);
      expect(rels[0]).toMatchObject({
        from_table: 'orders',
        to_table: 'users',
        confidence: 'high',
      });
    });

    it('returns empty on error', async () => {
      // getDatasets for listSchemas
      mockGetDatasets.mockResolvedValueOnce([[{ id: 'ds1' }]]);
      // Query fails
      mockQuery.mockRejectedValueOnce(new Error('constraint views not available'));

      const connector = makeConnector();
      await connector.connect();
      const rels = await connector.detectRelationships();

      expect(rels).toEqual([]);
    });
  });
});
