import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createAdapter, scaffoldFromSchema, compile, computeTier } from '../index.js';

// IMPORTANT: Import from the local package, not from '@runcontext/core'
// This test lives inside packages/core so imports should be relative

let tmpDir: string;

// Skip if duckdb not installed or native driver doesn't work in this environment
let available = false;
try {
  const { createAdapter: probeCreate } = await import('../index.js');
  const probe = await probeCreate({ adapter: 'duckdb', path: ':memory:' });
  await Promise.race([
    probe.connect().then(() => probe.disconnect()).then(() => true),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
  ]);
  available = true;
} catch {
  // duckdb not installed, native binary broken, or connect hangs
}

if (!available) {
  describe.skip('E2E data-aware (duckdb not installed)', () => {
    it('skipped', () => {});
  });
} else {
  describe('E2E: introspect \u2192 scaffold \u2192 tier', () => {
    beforeAll(async () => {
      tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ck-e2e-'));

      // Create a DuckDB database with test data
      const adapter = await createAdapter({ adapter: 'duckdb', path: ':memory:' });
      await adapter.connect();
      await adapter.query(
        `CREATE TABLE products (product_id VARCHAR PRIMARY KEY, name VARCHAR, price DOUBLE, category VARCHAR)`,
      );
      await adapter.query(
        `INSERT INTO products VALUES ('p1','Latte',4.50,'Coffee'),('p2','Muffin',3.00,'Food')`,
      );
      await adapter.query(
        `CREATE TABLE orders (order_id VARCHAR PRIMARY KEY, product_id VARCHAR, quantity INTEGER, total DOUBLE, order_date DATE)`,
      );
      await adapter.query(
        `INSERT INTO orders VALUES ('o1','p1',2,9.00,'2024-01-01'),('o2','p2',1,3.00,'2024-01-02')`,
      );

      // Introspect
      const tables = await adapter.listTables();
      const columns: Record<string, any[]> = {};
      for (const t of tables) {
        columns[t.name] = await adapter.listColumns(t.name);
      }
      await adapter.disconnect();

      // Scaffold
      const result = scaffoldFromSchema({
        modelName: 'test-shop',
        dataSourceName: 'warehouse',
        tables,
        columns,
      });

      // Write files
      const contextDir = path.join(tmpDir, 'context');
      mkdirSync(path.join(contextDir, 'models'), { recursive: true });
      mkdirSync(path.join(contextDir, 'governance'), { recursive: true });
      mkdirSync(path.join(contextDir, 'owners'), { recursive: true });

      writeFileSync(path.join(contextDir, 'models', result.files.osi), result.osiYaml);
      writeFileSync(
        path.join(contextDir, 'governance', result.files.governance),
        result.governanceYaml,
      );
      writeFileSync(path.join(contextDir, 'owners', result.files.owner), result.ownerYaml);
    });

    afterAll(() => {
      if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    });

    it('scaffolded files pass Bronze tier', async () => {
      const { graph } = await compile({
        contextDir: path.join(tmpDir, 'context'),
      });
      const tier = computeTier('test-shop', graph);
      expect(tier.tier).toBe('bronze');
      expect(tier.bronze.passed).toBe(true);
    });

    it('scaffolded OSI contains both datasets', () => {
      const osiContent = readFileSync(
        path.join(tmpDir, 'context', 'models', 'test-shop.osi.yaml'),
        'utf-8',
      );
      expect(osiContent).toContain('name: products');
      expect(osiContent).toContain('name: orders');
      expect(osiContent).toContain('name: product_id');
      expect(osiContent).toContain('name: price');
    });
  });
}
