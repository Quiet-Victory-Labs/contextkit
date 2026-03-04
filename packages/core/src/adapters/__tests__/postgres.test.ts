import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const PG_URL = process.env.CONTEXTKIT_PG_TEST_URL;

if (!PG_URL) {
  describe.skip('PostgresAdapter (set CONTEXTKIT_PG_TEST_URL to enable)', () => {
    it('skipped', () => {});
  });
} else {
  const { PostgresAdapter } = await import('../postgres.js');

  describe('PostgresAdapter', () => {
    let adapter: InstanceType<typeof PostgresAdapter>;

    beforeAll(async () => {
      adapter = new PostgresAdapter(PG_URL!);
      await adapter.connect();
      await adapter.query('CREATE TABLE IF NOT EXISTS ck_test_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL)');
      await adapter.query('TRUNCATE ck_test_users');
      await adapter.query("INSERT INTO ck_test_users (name) VALUES ('Alice'), ('Bob')");
    });

    afterAll(async () => {
      await adapter.query('DROP TABLE IF EXISTS ck_test_users');
      await adapter.disconnect();
    });

    it('listTables includes test table', async () => {
      const tables = await adapter.listTables();
      const names = tables.map((t) => t.name);
      expect(names).toContain('ck_test_users');
    });

    it('listColumns returns column info', async () => {
      const cols = await adapter.listColumns('ck_test_users');
      expect(cols.length).toBeGreaterThanOrEqual(2);
      const idCol = cols.find((c) => c.name === 'id')!;
      expect(idCol.is_primary_key).toBe(true);
    });

    it('query returns rows', async () => {
      const result = await adapter.query('SELECT name FROM ck_test_users ORDER BY id');
      expect(result.row_count).toBe(2);
      expect(result.rows[0]).toEqual({ name: 'Alice' });
    });
  });
}
