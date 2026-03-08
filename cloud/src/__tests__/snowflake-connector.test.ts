import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnowflakeConnector } from '../connectors/snowflake.js';
import { ConnectionStateError, ConnectorError } from '../connectors/base.js';

// ── Mock snowflake-sdk ────────────────────────────────────────────

const mockExecute = vi.fn();
const mockConnect = vi.fn();
const mockDestroy = vi.fn();

vi.mock('snowflake-sdk', () => ({
  createConnection: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    destroy: mockDestroy,
    execute: mockExecute,
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────

function makeConnector() {
  return new SnowflakeConnector({
    connection: {
      account: 'test_account',
      username: 'test_user',
      password: 'test_pass',
      database: 'TEST_DB',
      warehouse: 'TEST_WH',
    },
  });
}

/** Simulate a successful snowflake connect callback */
function setupConnect() {
  mockConnect.mockImplementation((cb: (err?: Error) => void) => cb());
}

/** Simulate a successful snowflake destroy callback */
function setupDestroy() {
  mockDestroy.mockImplementation((cb: (err?: Error) => void) => cb());
}

/** Make mockExecute return given rows */
function mockQueryResult<T>(rows: T[]) {
  mockExecute.mockImplementationOnce(
    (opts: { complete: (err: Error | undefined, stmt: unknown, rows: T[]) => void }) => {
      opts.complete(undefined, {}, rows);
    },
  );
}

// ── Tests ─────────────────────────────────────────────────────────

describe('SnowflakeConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupConnect();
    setupDestroy();
  });

  // ── Connection ──────────────────────────────────────────────

  describe('connection lifecycle', () => {
    it('connects via snowflake-sdk', async () => {
      const connector = makeConnector();
      await connector.connect();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('throws ConnectorError on failed connection', async () => {
      mockConnect.mockImplementation((cb: (err?: Error) => void) =>
        cb(new Error('auth failed')),
      );

      const connector = makeConnector();
      await expect(connector.connect()).rejects.toThrow(ConnectorError);
    });

    it('disconnects by calling destroy', async () => {
      const connector = makeConnector();
      await connector.connect();
      await connector.disconnect();
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('throws ConnectionStateError when querying before connect', async () => {
      const connector = makeConnector();
      await expect(connector.listSchemas()).rejects.toThrow(ConnectionStateError);
    });
  });

  // ── listSchemas ─────────────────────────────────────────────

  describe('listSchemas', () => {
    it('returns schema names from INFORMATION_SCHEMA', async () => {
      mockQueryResult([{ SCHEMA_NAME: 'PUBLIC' }, { SCHEMA_NAME: 'RAW' }]);

      const connector = makeConnector();
      await connector.connect();
      const schemas = await connector.listSchemas();

      expect(schemas).toEqual(['PUBLIC', 'RAW']);
    });
  });

  // ── listTables ──────────────────────────────────────────────

  describe('listTables', () => {
    it('returns tables with metadata', async () => {
      mockQueryResult([
        { schema: 'PUBLIC', name: 'USERS', type: 'BASE TABLE', row_count: 100, comment: null },
        { schema: 'PUBLIC', name: 'USER_V', type: 'VIEW', row_count: null, comment: 'a view' },
      ]);

      const connector = makeConnector();
      await connector.connect();
      const tables = await connector.listTables('PUBLIC');

      expect(tables).toHaveLength(2);
      expect(tables[0]).toMatchObject({ schema: 'PUBLIC', name: 'USERS', type: 'table' });
      expect(tables[1]).toMatchObject({ schema: 'PUBLIC', name: 'USER_V', type: 'view' });
    });
  });

  // ── describeTable ───────────────────────────────────────────

  describe('describeTable', () => {
    it('returns column metadata with primary keys', async () => {
      // Columns query
      mockQueryResult([
        { name: 'ID', data_type: 'NUMBER', nullable: 'NO', default_value: null, comment: null },
        { name: 'NAME', data_type: 'VARCHAR', nullable: 'YES', default_value: null, comment: null },
      ]);
      // Primary keys query
      mockQueryResult([{ column_name: 'ID' }]);

      const connector = makeConnector();
      await connector.connect();
      const columns = await connector.describeTable('PUBLIC', 'USERS');

      expect(columns).toHaveLength(2);
      expect(columns[0]).toMatchObject({ name: 'ID', is_primary_key: true, nullable: false });
      expect(columns[1]).toMatchObject({ name: 'NAME', is_primary_key: false, nullable: true });
    });
  });

  // ── getTableStats ───────────────────────────────────────────

  describe('getTableStats', () => {
    it('returns row count and size', async () => {
      mockQueryResult([{ row_count: 500, size_bytes: 8192, last_modified: '2025-01-01T00:00:00Z' }]);

      const connector = makeConnector();
      await connector.connect();
      const stats = await connector.getTableStats('PUBLIC', 'USERS');

      expect(stats).toEqual({
        schema: 'PUBLIC',
        table: 'USERS',
        row_count_estimate: 500,
        size_bytes: 8192,
        last_modified: '2025-01-01T00:00:00Z',
      });
    });

    it('returns zero when table not found', async () => {
      mockQueryResult([]);

      const connector = makeConnector();
      await connector.connect();
      const stats = await connector.getTableStats('PUBLIC', 'MISSING');

      expect(stats.row_count_estimate).toBe(0);
    });
  });

  // ── getViewDefinition ───────────────────────────────────────

  describe('getViewDefinition', () => {
    it('returns the view SQL', async () => {
      mockQueryResult([{ VIEW_DEFINITION: 'SELECT ID, NAME FROM USERS' }]);

      const connector = makeConnector();
      await connector.connect();
      const def = await connector.getViewDefinition('PUBLIC', 'USER_V');

      expect(def).toBe('SELECT ID, NAME FROM USERS');
    });

    it('returns null for non-existent view', async () => {
      mockQueryResult([]);

      const connector = makeConnector();
      await connector.connect();
      const def = await connector.getViewDefinition('PUBLIC', 'MISSING');

      expect(def).toBeNull();
    });
  });

  // ── detectRelationships ─────────────────────────────────────

  describe('detectRelationships', () => {
    it('returns foreign key relationships from SHOW IMPORTED KEYS', async () => {
      mockQueryResult([
        {
          fk_schema_name: 'PUBLIC',
          fk_table_name: 'ORDERS',
          fk_column_name: 'USER_ID',
          pk_schema_name: 'PUBLIC',
          pk_table_name: 'USERS',
          pk_column_name: 'ID',
        },
      ]);

      const connector = makeConnector();
      await connector.connect();
      const rels = await connector.detectRelationships('PUBLIC');

      expect(rels).toHaveLength(1);
      expect(rels[0]).toMatchObject({
        from_table: 'ORDERS',
        from_column: 'USER_ID',
        to_table: 'USERS',
        to_column: 'ID',
        confidence: 'high',
      });
    });

    it('returns empty array on error', async () => {
      mockExecute.mockImplementationOnce(
        (opts: { complete: (err: Error | undefined, stmt: unknown, rows: unknown[]) => void }) => {
          opts.complete(new Error('not supported'), {}, []);
        },
      );

      const connector = makeConnector();
      await connector.connect();
      const rels = await connector.detectRelationships();

      expect(rels).toEqual([]);
    });
  });
});
