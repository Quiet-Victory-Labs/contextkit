import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Skip entire suite if duckdb is not available or cannot connect
// (native module may fail in certain environments like Vitest workers)
let DuckDBAdapter: any;
let duckdbAvailable = false;
try {
  const mod = await import('../duckdb.js');
  DuckDBAdapter = mod.DuckDBAdapter;
  // Verify the native driver actually works by attempting a quick connection
  const probe = new DuckDBAdapter(':memory:');
  await Promise.race([
    probe.connect().then(() => probe.disconnect()).then(() => true),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
  ]);
  duckdbAvailable = true;
} catch {
  // duckdb not installed, native binary missing, or connect hangs
}

if (!duckdbAvailable) {
  describe.skip('DuckDBAdapter (duckdb not available)', () => {
    it('skipped', () => {});
  });
}

if (duckdbAvailable) {
  describe('DuckDBAdapter', () => {
    let adapter: InstanceType<typeof DuckDBAdapter>;

    beforeAll(async () => {
      adapter = new DuckDBAdapter(':memory:');
      await adapter.connect();
      await adapter.query(`
        CREATE TABLE users (
          user_id INTEGER PRIMARY KEY,
          name VARCHAR NOT NULL,
          email VARCHAR,
          created_at TIMESTAMP
        )
      `);
      await adapter.query(`
        INSERT INTO users VALUES
          (1, 'Alice', 'alice@test.com', '2024-01-01'),
          (2, 'Bob', 'bob@test.com', '2024-02-01'),
          (3, 'Carol', NULL, '2024-03-01')
      `);
      await adapter.query(`
        CREATE VIEW vw_active_users AS
        SELECT * FROM users WHERE email IS NOT NULL
      `);
    });

    afterAll(async () => {
      await adapter.disconnect();
    });

    it('listTables returns tables and views', async () => {
      const tables = await adapter.listTables();
      const names = tables.map((t: any) => t.name);
      expect(names).toContain('users');
      expect(names).toContain('vw_active_users');
      const users = tables.find((t: any) => t.name === 'users')!;
      expect(users.type).toBe('table');
      expect(users.row_count).toBe(3);
      const view = tables.find((t: any) => t.name === 'vw_active_users')!;
      expect(view.type).toBe('view');
    });

    it('listColumns returns column metadata', async () => {
      const cols = await adapter.listColumns('users');
      expect(cols).toHaveLength(4);
      const idCol = cols.find((c: any) => c.name === 'user_id')!;
      expect(idCol.is_primary_key).toBe(true);
      expect(idCol.nullable).toBe(false);
      const emailCol = cols.find((c: any) => c.name === 'email')!;
      expect(emailCol.nullable).toBe(true);
    });

    it('query returns rows and metadata', async () => {
      const result = await adapter.query('SELECT name FROM users ORDER BY user_id');
      expect(result.columns).toEqual(['name']);
      expect(result.row_count).toBe(3);
      expect(result.rows[0]).toEqual({ name: 'Alice' });
    });
  });
}
