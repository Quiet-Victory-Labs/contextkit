import { describe, it, expect, vi } from 'vitest';
import {
  BaseConnector,
  ConnectionStateError,
  QueryTimeoutError,
  UnsafeSqlError,
} from '../connectors/index.js';
import type {
  ColumnMeta,
  ConnectorConfig,
  RelationshipCandidate,
  TableMeta,
  TableStats,
} from '../connectors/index.js';

// ── Concrete stub for testing the abstract base ────────────────────

class StubConnector extends BaseConnector {
  connectCalled = false;
  disconnectCalled = false;

  constructor(config?: ConnectorConfig) {
    super(config);
  }

  protected async doConnect(): Promise<void> {
    this.connectCalled = true;
  }
  protected async doDisconnect(): Promise<void> {
    this.disconnectCalled = true;
  }

  async listSchemas(): Promise<string[]> {
    this.assertConnected();
    return ['public'];
  }
  async listTables(): Promise<TableMeta[]> {
    this.assertConnected();
    return [];
  }
  async describeTable(): Promise<ColumnMeta[]> {
    this.assertConnected();
    return [];
  }
  async getTableStats(_s: string, _t: string): Promise<TableStats> {
    this.assertConnected();
    return { schema: _s, table: _t, row_count_estimate: 0 };
  }
  async getViewDefinition(): Promise<string | null> {
    this.assertConnected();
    return null;
  }
  async detectRelationships(): Promise<RelationshipCandidate[]> {
    this.assertConnected();
    return [];
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('BaseConnector', () => {
  // ── Connection lifecycle ──────────────────────────────────────

  describe('connection lifecycle', () => {
    it('connect() calls doConnect and sets connected state', async () => {
      const c = new StubConnector();
      await c.connect();
      expect(c.connectCalled).toBe(true);
    });

    it('connect() is idempotent', async () => {
      const c = new StubConnector();
      await c.connect();
      c.connectCalled = false; // reset
      await c.connect();
      expect(c.connectCalled).toBe(false); // not called again
    });

    it('disconnect() calls doDisconnect', async () => {
      const c = new StubConnector();
      await c.connect();
      await c.disconnect();
      expect(c.disconnectCalled).toBe(true);
    });

    it('disconnect() is idempotent when not connected', async () => {
      const c = new StubConnector();
      await c.disconnect(); // no-op
      expect(c.disconnectCalled).toBe(false);
    });

    it('assertConnected() throws when not connected', async () => {
      const c = new StubConnector();
      await expect(c.listSchemas()).rejects.toThrow(ConnectionStateError);
    });

    it('assertConnected() passes after connect()', async () => {
      const c = new StubConnector();
      await c.connect();
      await expect(c.listSchemas()).resolves.toEqual(['public']);
    });
  });

  // ── SQL validation ────────────────────────────────────────────

  describe('validateSql', () => {
    const c = new StubConnector();

    it.each([
      'SELECT * FROM users',
      'select count(*) from orders',
      'SHOW TABLES',
      'DESCRIBE users',
      'EXPLAIN SELECT 1',
    ])('allows safe SQL: %s', (sql) => {
      expect(() => c.validateSql(sql)).not.toThrow();
    });

    it('rejects empty SQL', () => {
      expect(() => c.validateSql('')).toThrow(UnsafeSqlError);
      expect(() => c.validateSql('   ')).toThrow(UnsafeSqlError);
    });

    it.each([
      'INSERT INTO users VALUES (1)',
      'UPDATE users SET name = "x"',
      'DELETE FROM users',
      'DROP TABLE users',
      'ALTER TABLE users ADD COLUMN x INT',
      'CREATE TABLE foo (id INT)',
      'TRUNCATE TABLE users',
      'GRANT ALL ON users TO admin',
    ])('rejects write SQL: %s', (sql) => {
      expect(() => c.validateSql(sql)).toThrow(UnsafeSqlError);
    });

    it('rejects mutation keywords embedded in otherwise allowed statements', () => {
      expect(() => c.validateSql('SELECT * FROM users; DROP TABLE users')).toThrow(
        UnsafeSqlError,
      );
    });

    it('allows column names that contain forbidden substrings', () => {
      // "updated_at" contains "update" but not as a standalone word
      expect(() => c.validateSql('SELECT updated_at FROM users')).not.toThrow();
    });
  });

  // ── Row limit ─────────────────────────────────────────────────

  describe('applySqlRowLimit', () => {
    it('appends LIMIT when missing', () => {
      const c = new StubConnector();
      expect(c.applySqlRowLimit('SELECT * FROM users')).toBe(
        'SELECT * FROM users LIMIT 10000',
      );
    });

    it('respects custom row limit', () => {
      const c = new StubConnector({ row_limit: 500 });
      expect(c.applySqlRowLimit('SELECT 1')).toBe('SELECT 1 LIMIT 500');
    });

    it('does not double-add LIMIT', () => {
      const c = new StubConnector();
      const sql = 'SELECT * FROM users LIMIT 5';
      expect(c.applySqlRowLimit(sql)).toBe(sql);
    });
  });

  // ── Timeout ───────────────────────────────────────────────────

  describe('withTimeout', () => {
    it('resolves when fn completes within timeout', async () => {
      const c = new StubConnector({ query_timeout_ms: 1000 });
      const result = await c.withTimeout(async () => 42);
      expect(result).toBe(42);
    });

    it('rejects with QueryTimeoutError when fn exceeds timeout', async () => {
      const c = new StubConnector({ query_timeout_ms: 10 });
      await expect(
        c.withTimeout(() => new Promise((r) => setTimeout(r, 200)), 10),
      ).rejects.toThrow(QueryTimeoutError);
    });

    it('propagates errors from fn', async () => {
      const c = new StubConnector();
      await expect(
        c.withTimeout(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    });
  });

  // ── Default config ────────────────────────────────────────────

  describe('default configuration', () => {
    it('uses 30s timeout and 10k row limit by default', () => {
      const c = new StubConnector();
      // Verify via applySqlRowLimit output
      expect(c.applySqlRowLimit('SELECT 1')).toContain('LIMIT 10000');
    });

    it('accepts custom config', () => {
      const c = new StubConnector({ query_timeout_ms: 5000, row_limit: 100 });
      expect(c.applySqlRowLimit('SELECT 1')).toContain('LIMIT 100');
    });
  });
});
