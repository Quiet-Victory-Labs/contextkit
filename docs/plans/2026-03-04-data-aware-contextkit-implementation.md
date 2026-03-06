# Data-Aware ContextKit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add database connectivity to ContextKit so it can introspect schemas, scaffold OSI metadata from real data, validate metadata accuracy against live databases, and suggest enrichments for tier promotion.

**Architecture:** New `adapters/` and `introspect/` modules in `@runcontext/core` with DuckDB and Postgres drivers as optional peer deps. Eight new `data/*` lint rules plug into the existing lint engine. Three new CLI commands (`introspect`, `verify`, `enrich`) in `@runcontext/cli`.

**Tech Stack:** TypeScript, vitest, commander, duckdb (npm), pg (npm), Zod, yaml (npm)

---

### Task 1: Adapter Types and Factory

**Files:**
- Create: `packages/core/src/adapters/types.ts`
- Create: `packages/core/src/adapters/index.ts`
- Test: `packages/core/src/adapters/__tests__/factory.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/adapters/__tests__/factory.test.ts
import { describe, it, expect } from 'vitest';
import { createAdapter } from '../index.js';

describe('createAdapter', () => {
  it('throws on unknown adapter type', async () => {
    await expect(
      createAdapter({ adapter: 'oracle' as any }),
    ).rejects.toThrow('Unknown adapter: oracle');
  });

  it('throws when duckdb config missing path', async () => {
    await expect(
      createAdapter({ adapter: 'duckdb' }),
    ).rejects.toThrow('DuckDB adapter requires "path"');
  });

  it('throws when postgres config missing connection', async () => {
    await expect(
      createAdapter({ adapter: 'postgres' }),
    ).rejects.toThrow('Postgres adapter requires "connection"');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/adapters/__tests__/factory.test.ts`
Expected: FAIL — modules don't exist yet

**Step 3: Write the types and factory**

```typescript
// packages/core/src/adapters/types.ts
export interface TableInfo {
  name: string;
  type: 'table' | 'view';
  schema?: string;
  row_count: number;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
}

export interface DataAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTables(): Promise<TableInfo[]>;
  listColumns(table: string): Promise<ColumnInfo[]>;
  query(sql: string): Promise<QueryResult>;
}

export interface DataSourceConfig {
  adapter: 'duckdb' | 'postgres';
  path?: string;
  connection?: string;
}
```

```typescript
// packages/core/src/adapters/index.ts
export type { DataAdapter, DataSourceConfig, TableInfo, ColumnInfo, QueryResult } from './types.js';

import type { DataAdapter, DataSourceConfig } from './types.js';

export async function createAdapter(config: DataSourceConfig): Promise<DataAdapter> {
  switch (config.adapter) {
    case 'duckdb': {
      if (!config.path) throw new Error('DuckDB adapter requires "path"');
      const { DuckDBAdapter } = await import('./duckdb.js');
      return new DuckDBAdapter(config.path);
    }
    case 'postgres': {
      if (!config.connection) throw new Error('Postgres adapter requires "connection"');
      const { PostgresAdapter } = await import('./postgres.js');
      return new PostgresAdapter(config.connection);
    }
    default:
      throw new Error(`Unknown adapter: ${(config as any).adapter}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/adapters/__tests__/factory.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/core/src/adapters/
git commit -m "feat(core): add DataAdapter interface and factory"
```

---

### Task 2: DuckDB Adapter

**Files:**
- Create: `packages/core/src/adapters/duckdb.ts`
- Test: `packages/core/src/adapters/__tests__/duckdb.test.ts`
- Modify: `packages/core/package.json` — add `duckdb` as optional peer dep

**Step 1: Write the failing test**

This test uses a real in-memory DuckDB database. Skip it in CI if `duckdb` isn't installed.

```typescript
// packages/core/src/adapters/__tests__/duckdb.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Skip entire suite if duckdb not available
let DuckDBAdapter: any;
try {
  const mod = await import('../duckdb.js');
  DuckDBAdapter = mod.DuckDBAdapter;
} catch {
  describe.skip('DuckDBAdapter (duckdb not installed)', () => {
    it('skipped', () => {});
  });
}

if (DuckDBAdapter) {
  describe('DuckDBAdapter', () => {
    let adapter: InstanceType<typeof DuckDBAdapter>;

    beforeAll(async () => {
      adapter = new DuckDBAdapter(':memory:');
      await adapter.connect();
      // Create test tables
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
      const names = tables.map((t) => t.name);
      expect(names).toContain('users');
      expect(names).toContain('vw_active_users');
      const users = tables.find((t) => t.name === 'users')!;
      expect(users.type).toBe('table');
      expect(users.row_count).toBe(3);
      const view = tables.find((t) => t.name === 'vw_active_users')!;
      expect(view.type).toBe('view');
    });

    it('listColumns returns column metadata', async () => {
      const cols = await adapter.listColumns('users');
      expect(cols).toHaveLength(4);
      const idCol = cols.find((c) => c.name === 'user_id')!;
      expect(idCol.is_primary_key).toBe(true);
      expect(idCol.nullable).toBe(false);
      const emailCol = cols.find((c) => c.name === 'email')!;
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/adapters/__tests__/duckdb.test.ts`
Expected: FAIL — `./duckdb.js` doesn't exist

**Step 3: Install duckdb and implement adapter**

Run: `cd packages/core && npm install --save-dev duckdb`

Then add to `package.json` peerDependencies:

```json
"peerDependencies": {
  "duckdb": "^1.0.0"
},
"peerDependenciesMeta": {
  "duckdb": { "optional": true }
}
```

```typescript
// packages/core/src/adapters/duckdb.ts
import type { DataAdapter, TableInfo, ColumnInfo, QueryResult } from './types.js';

export class DuckDBAdapter implements DataAdapter {
  private db: any;
  private conn: any;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async connect(): Promise<void> {
    const duckdb = await import('duckdb');
    return new Promise((resolve, reject) => {
      this.db = new duckdb.default.Database(this.dbPath, { access_mode: 'READ_ONLY' }, (err: Error | null) => {
        if (err) return reject(err);
        this.conn = this.db.connect();
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async listTables(): Promise<TableInfo[]> {
    const tablesResult = await this.query(`
      SELECT table_name AS name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'main'
      ORDER BY table_name
    `);

    const tables: TableInfo[] = [];
    for (const row of tablesResult.rows) {
      const name = row.name as string;
      const isView = (row.table_type as string) === 'VIEW';
      let rowCount = 0;
      try {
        const countResult = await this.query(`SELECT COUNT(*) AS cnt FROM "${name}"`);
        rowCount = Number(countResult.rows[0]?.cnt ?? 0);
      } catch {
        // view or inaccessible table
      }
      tables.push({
        name,
        type: isView ? 'view' : 'table',
        schema: 'main',
        row_count: rowCount,
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const colResult = await this.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = '${table}' AND table_schema = 'main'
      ORDER BY ordinal_position
    `);

    // Get primary key columns
    const pkResult = await this.query(`
      SELECT column_name
      FROM information_schema.key_column_usage
      WHERE table_name = '${table}' AND table_schema = 'main'
        AND constraint_name LIKE '%_pkey'
    `).catch(() => ({ rows: [], columns: [], row_count: 0 }));

    const pkCols = new Set(pkResult.rows.map((r) => r.column_name as string));

    return colResult.rows.map((row) => ({
      name: row.column_name as string,
      data_type: row.data_type as string,
      nullable: (row.is_nullable as string) === 'YES',
      is_primary_key: pkCols.has(row.column_name as string),
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, (err: Error | null, rows: Record<string, unknown>[]) => {
        if (err) return reject(err);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        resolve({ columns, rows, row_count: rows.length });
      });
    });
  }
}
```

Note: The constructor for in-memory databases (`:memory:`) needs read-write access. Update `connect()` to only use `READ_ONLY` when the path is not `:memory:`:

```typescript
async connect(): Promise<void> {
  const duckdb = await import('duckdb');
  const opts = this.dbPath === ':memory:' ? {} : { access_mode: 'READ_ONLY' };
  return new Promise((resolve, reject) => {
    this.db = new duckdb.default.Database(this.dbPath, opts, (err: Error | null) => {
      if (err) return reject(err);
      this.conn = this.db.connect();
      resolve();
    });
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/adapters/__tests__/duckdb.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/adapters/duckdb.ts packages/core/src/adapters/__tests__/duckdb.test.ts packages/core/package.json
git commit -m "feat(core): add DuckDB adapter with tests"
```

---

### Task 3: Postgres Adapter

**Files:**
- Create: `packages/core/src/adapters/postgres.ts`
- Test: `packages/core/src/adapters/__tests__/postgres.test.ts`
- Modify: `packages/core/package.json` — add `pg` as optional peer dep

**Step 1: Write the failing test**

Postgres tests require a running database, so they skip by default. Use `CONTEXTKIT_PG_TEST_URL` env var to opt in.

```typescript
// packages/core/src/adapters/__tests__/postgres.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/adapters/__tests__/postgres.test.ts`
Expected: FAIL (or skip if no PG URL) — `./postgres.js` doesn't exist

**Step 3: Implement Postgres adapter**

Add to `package.json` peerDependencies:
```json
"pg": "^8.0.0"
```
And peerDependenciesMeta:
```json
"pg": { "optional": true }
```

Install for dev: `cd packages/core && npm install --save-dev pg @types/pg`

```typescript
// packages/core/src/adapters/postgres.ts
import type { DataAdapter, TableInfo, ColumnInfo, QueryResult } from './types.js';

export class PostgresAdapter implements DataAdapter {
  private client: any;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    const pg = await import('pg');
    this.client = new pg.default.Client({ connectionString: this.connectionString });
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
    }
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.client.query(`
      SELECT t.table_name AS name, t.table_type
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
      ORDER BY t.table_name
    `);

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      let rowCount = 0;
      try {
        const countRes = await this.client.query(`SELECT COUNT(*) AS cnt FROM "${row.name}"`);
        rowCount = Number(countRes.rows[0]?.cnt ?? 0);
      } catch {
        // skip
      }
      tables.push({
        name: row.name,
        type: row.table_type === 'VIEW' ? 'view' : 'table',
        schema: 'public',
        row_count: rowCount,
      });
    }
    return tables;
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const colResult = await this.client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [table]);

    const pkResult = await this.client.query(`
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `, [table]).catch(() => ({ rows: [] }));

    const pkCols = new Set(pkResult.rows.map((r: any) => r.column_name));

    return colResult.rows.map((row: any) => ({
      name: row.column_name,
      data_type: row.data_type,
      nullable: row.is_nullable === 'YES',
      is_primary_key: pkCols.has(row.column_name),
    }));
  }

  async query(sql: string): Promise<QueryResult> {
    const result = await this.client.query(sql);
    return {
      columns: result.fields?.map((f: any) => f.name) ?? [],
      rows: result.rows ?? [],
      row_count: result.rows?.length ?? 0,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/adapters/__tests__/postgres.test.ts`
Expected: PASS (or SKIP if no PG URL — both are fine)

**Step 5: Commit**

```bash
git add packages/core/src/adapters/postgres.ts packages/core/src/adapters/__tests__/postgres.test.ts packages/core/package.json
git commit -m "feat(core): add Postgres adapter with tests"
```

---

### Task 4: Config Schema Extension

**Files:**
- Modify: `packages/core/src/types/config.ts`
- Modify: `packages/core/src/schema/config.ts`
- Test: `packages/core/src/config/__tests__/data-sources.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/config/__tests__/data-sources.test.ts
import { describe, it, expect } from 'vitest';
import { contextKitConfigSchema } from '../../schema/config.js';

describe('data_sources config', () => {
  it('accepts valid duckdb data source', () => {
    const config = contextKitConfigSchema.parse({
      data_sources: {
        warehouse: { adapter: 'duckdb', path: './data.duckdb' },
      },
    });
    expect(config.data_sources!.warehouse.adapter).toBe('duckdb');
    expect(config.data_sources!.warehouse.path).toBe('./data.duckdb');
  });

  it('accepts valid postgres data source', () => {
    const config = contextKitConfigSchema.parse({
      data_sources: {
        analytics: { adapter: 'postgres', connection: 'postgresql://localhost/db' },
      },
    });
    expect(config.data_sources!.analytics.adapter).toBe('postgres');
  });

  it('accepts multiple data sources', () => {
    const config = contextKitConfigSchema.parse({
      data_sources: {
        a: { adapter: 'duckdb', path: './a.duckdb' },
        b: { adapter: 'postgres', connection: 'postgresql://localhost/b' },
      },
    });
    expect(Object.keys(config.data_sources!)).toHaveLength(2);
  });

  it('config without data_sources still works', () => {
    const config = contextKitConfigSchema.parse({});
    expect(config.data_sources).toBeUndefined();
  });

  it('rejects unknown adapter type', () => {
    expect(() =>
      contextKitConfigSchema.parse({
        data_sources: { x: { adapter: 'oracle' } },
      }),
    ).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/config/__tests__/data-sources.test.ts`
Expected: FAIL — `data_sources` not in schema

**Step 3: Extend types and schema**

Add to `packages/core/src/types/config.ts`:
```typescript
import type { DataSourceConfig } from '../adapters/types.js';

export interface ContextKitConfig {
  // ... existing fields ...
  data_sources?: Record<string, DataSourceConfig>;
}
```

Add to `packages/core/src/schema/config.ts`:
```typescript
export const dataSourceConfigSchema = z.object({
  adapter: z.enum(['duckdb', 'postgres']),
  path: z.string().optional(),
  connection: z.string().optional(),
});

export const contextKitConfigSchema = z.object({
  // ... existing fields ...
  data_sources: z.record(z.string(), dataSourceConfigSchema).optional(),
});
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/config/__tests__/data-sources.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/types/config.ts packages/core/src/schema/config.ts packages/core/src/config/__tests__/data-sources.test.ts
git commit -m "feat(core): add data_sources to config schema"
```

---

### Task 5: Introspection Heuristics

**Files:**
- Create: `packages/core/src/introspect/heuristics.ts`
- Test: `packages/core/src/introspect/__tests__/heuristics.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/introspect/__tests__/heuristics.test.ts
import { describe, it, expect } from 'vitest';
import {
  inferTableType,
  inferGrain,
  inferSemanticRole,
  inferAggregation,
} from '../heuristics.js';
import type { ColumnInfo } from '../../adapters/types.js';

describe('inferTableType', () => {
  it('views starting with vw_ are view', () => {
    expect(inferTableType('vw_coffee_shops', 'view', [])).toBe('view');
  });

  it('tables with date column and no PK are event', () => {
    const cols: ColumnInfo[] = [
      { name: 'dispatch_date', data_type: 'DATE', nullable: false, is_primary_key: false },
      { name: 'category', data_type: 'VARCHAR', nullable: true, is_primary_key: false },
    ];
    expect(inferTableType('crime_incidents', 'table', cols)).toBe('event');
  });

  it('tables with single PK and mostly text are dimension', () => {
    const cols: ColumnInfo[] = [
      { name: 'business_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
      { name: 'name', data_type: 'VARCHAR', nullable: true, is_primary_key: false },
      { name: 'city', data_type: 'VARCHAR', nullable: true, is_primary_key: false },
    ];
    expect(inferTableType('yelp_business', 'table', cols)).toBe('dimension');
  });

  it('tables with numeric columns and FK-looking cols are fact', () => {
    const cols: ColumnInfo[] = [
      { name: 'review_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
      { name: 'business_id', data_type: 'VARCHAR', nullable: false, is_primary_key: false },
      { name: 'stars', data_type: 'DOUBLE', nullable: true, is_primary_key: false },
      { name: 'useful', data_type: 'INTEGER', nullable: true, is_primary_key: false },
    ];
    expect(inferTableType('yelp_reviews', 'table', cols)).toBe('fact');
  });
});

describe('inferGrain', () => {
  it('single PK produces readable grain', () => {
    const cols: ColumnInfo[] = [
      { name: 'business_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
      { name: 'name', data_type: 'VARCHAR', nullable: true, is_primary_key: false },
    ];
    expect(inferGrain('yelp_business', cols)).toBe(
      'one row per yelp_business identified by business_id',
    );
  });

  it('composite PK lists all key columns', () => {
    const cols: ColumnInfo[] = [
      { name: 'business_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
      { name: 'user_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
    ];
    expect(inferGrain('yelp_tips', cols)).toBe(
      'one row per unique combination of business_id, user_id',
    );
  });

  it('no PK produces fallback grain', () => {
    const cols: ColumnInfo[] = [
      { name: 'lat', data_type: 'DOUBLE', nullable: true, is_primary_key: false },
    ];
    expect(inferGrain('events', cols)).toBe(
      'one row per record (no primary key detected)',
    );
  });
});

describe('inferSemanticRole', () => {
  it('_id columns are identifier', () => {
    expect(inferSemanticRole('business_id', 'VARCHAR', true)).toBe('identifier');
  });

  it('PK columns are identifier', () => {
    expect(inferSemanticRole('geoid', 'VARCHAR', true)).toBe('identifier');
  });

  it('numeric columns with metric-like names are metric', () => {
    expect(inferSemanticRole('review_count', 'INTEGER', false)).toBe('metric');
    expect(inferSemanticRole('total_population', 'INTEGER', false)).toBe('metric');
    expect(inferSemanticRole('pct_renter_occupied', 'DOUBLE', false)).toBe('metric');
  });

  it('date/timestamp columns are date', () => {
    expect(inferSemanticRole('created_at', 'TIMESTAMP', false)).toBe('date');
    expect(inferSemanticRole('dispatch_date', 'DATE', false)).toBe('date');
  });

  it('everything else is dimension', () => {
    expect(inferSemanticRole('name', 'VARCHAR', false)).toBe('dimension');
    expect(inferSemanticRole('city', 'VARCHAR', false)).toBe('dimension');
  });
});

describe('inferAggregation', () => {
  it('count/total columns get SUM', () => {
    expect(inferAggregation('review_count')).toBe('SUM');
    expect(inferAggregation('total_population')).toBe('SUM');
  });

  it('avg/pct/rate columns get AVG', () => {
    expect(inferAggregation('avg_stars')).toBe('AVG');
    expect(inferAggregation('pct_renter_occupied')).toBe('AVG');
    expect(inferAggregation('demand_signal_rate')).toBe('AVG');
    expect(inferAggregation('median_household_income')).toBe('AVG');
  });

  it('fallback is SUM', () => {
    expect(inferAggregation('amount')).toBe('SUM');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/introspect/__tests__/heuristics.test.ts`
Expected: FAIL

**Step 3: Implement heuristics**

```typescript
// packages/core/src/introspect/heuristics.ts
import type { ColumnInfo } from '../adapters/types.js';

const DATE_TYPES = ['DATE', 'TIMESTAMP', 'TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE', 'timestamp without time zone', 'timestamp with time zone', 'date'];
const NUMERIC_TYPES = ['INTEGER', 'BIGINT', 'SMALLINT', 'DOUBLE', 'FLOAT', 'REAL', 'DECIMAL', 'NUMERIC', 'numeric', 'integer', 'bigint', 'smallint', 'double precision', 'real'];
const METRIC_PATTERNS = /count|total|sum|amount|pct|rate|avg|median|revenue|cost|price|score|population|income/i;

export function inferTableType(
  tableName: string,
  dbType: 'table' | 'view',
  columns: ColumnInfo[],
): string {
  if (dbType === 'view') return 'view';

  const hasPK = columns.some((c) => c.is_primary_key);
  const hasDateCol = columns.some((c) => DATE_TYPES.includes(c.data_type));
  const numericCols = columns.filter((c) => NUMERIC_TYPES.includes(c.data_type));
  const textCols = columns.filter((c) => c.data_type.toUpperCase().includes('VARCHAR') || c.data_type.toUpperCase().includes('TEXT'));
  const fkLikeCols = columns.filter((c) => !c.is_primary_key && c.name.endsWith('_id'));

  if (hasDateCol && !hasPK) return 'event';
  if (fkLikeCols.length > 0 && numericCols.length > fkLikeCols.length) return 'fact';
  if (hasPK && textCols.length >= numericCols.length) return 'dimension';

  return 'dimension';
}

export function inferGrain(tableName: string, columns: ColumnInfo[]): string {
  const pkCols = columns.filter((c) => c.is_primary_key);

  if (pkCols.length === 1) {
    return `one row per ${tableName} identified by ${pkCols[0].name}`;
  }
  if (pkCols.length > 1) {
    return `one row per unique combination of ${pkCols.map((c) => c.name).join(', ')}`;
  }
  return 'one row per record (no primary key detected)';
}

export function inferSemanticRole(
  columnName: string,
  dataType: string,
  isPrimaryKey: boolean,
): 'identifier' | 'metric' | 'dimension' | 'date' {
  if (isPrimaryKey || columnName.endsWith('_id')) return 'identifier';
  if (DATE_TYPES.includes(dataType)) return 'date';
  if (NUMERIC_TYPES.includes(dataType) && METRIC_PATTERNS.test(columnName)) return 'metric';
  return 'dimension';
}

export function inferAggregation(columnName: string): 'SUM' | 'AVG' | 'MAX' | 'MIN' {
  const lower = columnName.toLowerCase();
  if (/avg|pct|rate|median/.test(lower)) return 'AVG';
  if (/max/.test(lower)) return 'MAX';
  if (/min/.test(lower)) return 'MIN';
  return 'SUM';
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/introspect/__tests__/heuristics.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/introspect/
git commit -m "feat(core): add introspection heuristics for table/field inference"
```

---

### Task 6: Scaffold Module — Generate YAML from Schema

**Files:**
- Create: `packages/core/src/introspect/scaffold.ts`
- Create: `packages/core/src/introspect/index.ts`
- Test: `packages/core/src/introspect/__tests__/scaffold.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/introspect/__tests__/scaffold.test.ts
import { describe, it, expect } from 'vitest';
import { scaffoldFromSchema } from '../scaffold.js';
import type { TableInfo, ColumnInfo } from '../../adapters/types.js';

const tables: TableInfo[] = [
  { name: 'users', type: 'table', schema: 'main', row_count: 100 },
  { name: 'vw_active', type: 'view', schema: 'main', row_count: 80 },
];

const columns: Record<string, ColumnInfo[]> = {
  users: [
    { name: 'user_id', data_type: 'INTEGER', nullable: false, is_primary_key: true },
    { name: 'name', data_type: 'VARCHAR', nullable: false, is_primary_key: false },
    { name: 'created_at', data_type: 'TIMESTAMP', nullable: true, is_primary_key: false },
  ],
  vw_active: [
    { name: 'user_id', data_type: 'INTEGER', nullable: false, is_primary_key: false },
    { name: 'name', data_type: 'VARCHAR', nullable: false, is_primary_key: false },
  ],
};

describe('scaffoldFromSchema', () => {
  it('generates OSI model YAML', () => {
    const result = scaffoldFromSchema({
      modelName: 'test-model',
      dataSourceName: 'warehouse',
      tables,
      columns,
    });
    expect(result.osiYaml).toContain('name: test-model');
    expect(result.osiYaml).toContain('name: users');
    expect(result.osiYaml).toContain('name: vw_active');
    expect(result.osiYaml).toContain('name: user_id');
    expect(result.osiYaml).toContain('data_source: warehouse');
  });

  it('generates governance YAML with grain and table_type', () => {
    const result = scaffoldFromSchema({
      modelName: 'test-model',
      dataSourceName: 'warehouse',
      tables,
      columns,
    });
    expect(result.governanceYaml).toContain('model: test-model');
    expect(result.governanceYaml).toContain('owner: default-team');
    expect(result.governanceYaml).toContain('security: internal');
    expect(result.governanceYaml).toContain('grain:');
    expect(result.governanceYaml).toContain('table_type:');
  });

  it('generates owner YAML', () => {
    const result = scaffoldFromSchema({
      modelName: 'test-model',
      dataSourceName: 'warehouse',
      tables,
      columns,
    });
    expect(result.ownerYaml).toContain('id: default-team');
    expect(result.ownerYaml).toContain('display_name: Default Team');
  });

  it('returns file names', () => {
    const result = scaffoldFromSchema({
      modelName: 'test-model',
      dataSourceName: 'warehouse',
      tables,
      columns,
    });
    expect(result.files.osi).toBe('test-model.osi.yaml');
    expect(result.files.governance).toBe('test-model.governance.yaml');
    expect(result.files.owner).toBe('default-team.owner.yaml');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/introspect/__tests__/scaffold.test.ts`
Expected: FAIL

**Step 3: Implement scaffold**

```typescript
// packages/core/src/introspect/scaffold.ts
import * as yaml from 'yaml';
import type { TableInfo, ColumnInfo } from '../adapters/types.js';
import { inferTableType, inferGrain } from './heuristics.js';

export interface ScaffoldInput {
  modelName: string;
  dataSourceName: string;
  tables: TableInfo[];
  columns: Record<string, ColumnInfo[]>;
}

export interface ScaffoldResult {
  osiYaml: string;
  governanceYaml: string;
  ownerYaml: string;
  files: {
    osi: string;
    governance: string;
    owner: string;
  };
}

export function scaffoldFromSchema(input: ScaffoldInput): ScaffoldResult {
  const { modelName, dataSourceName, tables, columns } = input;

  // Build OSI model
  const datasets = tables.map((table) => {
    const cols = columns[table.name] ?? [];
    const pkCols = cols.filter((c) => c.is_primary_key).map((c) => c.name);

    return {
      name: table.name,
      description: `${table.type === 'view' ? 'View' : 'Table'}: ${table.name} (${table.row_count.toLocaleString()} rows)`,
      source: `${dataSourceName}.main.${table.name}`,
      data_source: dataSourceName,
      ...(pkCols.length > 0 ? { primary_key: pkCols } : {}),
      fields: cols.map((col) => ({
        name: col.name,
        description: col.name,
        expression: {
          dialects: [{ dialect: 'ANSI_SQL', expression: col.name }],
        },
      })),
    };
  });

  const osiDoc = {
    version: '1.0',
    semantic_model: [
      {
        name: modelName,
        description: `Semantic model scaffolded from ${dataSourceName}`,
        datasets,
      },
    ],
  };

  // Build governance
  const govDatasets: Record<string, any> = {};
  for (const table of tables) {
    const cols = columns[table.name] ?? [];
    govDatasets[table.name] = {
      grain: inferGrain(table.name, cols),
      table_type: inferTableType(table.name, table.type, cols),
    };
  }

  const govDoc = {
    model: modelName,
    owner: 'default-team',
    security: 'internal',
    datasets: govDatasets,
  };

  // Build owner
  const ownerDoc = {
    id: 'default-team',
    display_name: 'Default Team',
  };

  return {
    osiYaml: yaml.stringify(osiDoc, { lineWidth: 120 }),
    governanceYaml: yaml.stringify(govDoc, { lineWidth: 120 }),
    ownerYaml: yaml.stringify(ownerDoc, { lineWidth: 120 }),
    files: {
      osi: `${modelName}.osi.yaml`,
      governance: `${modelName}.governance.yaml`,
      owner: 'default-team.owner.yaml',
    },
  };
}
```

```typescript
// packages/core/src/introspect/index.ts
export { scaffoldFromSchema, type ScaffoldInput, type ScaffoldResult } from './scaffold.js';
export {
  inferTableType,
  inferGrain,
  inferSemanticRole,
  inferAggregation,
} from './heuristics.js';
export { enrichForTier, type EnrichResult } from './enrich.js';
```

Note: `enrich.js` doesn't exist yet — will be created in Task 10. For now, comment out or skip that export line. Add it back in Task 10.

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/introspect/__tests__/scaffold.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/introspect/
git commit -m "feat(core): add scaffold module to generate YAML from DB schema"
```

---

### Task 7: `context introspect` CLI Command

**Files:**
- Create: `packages/cli/src/commands/introspect.ts`
- Modify: `packages/cli/src/index.ts` — register the command

**Step 1: Implement the command**

```typescript
// packages/cli/src/commands/introspect.ts
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { loadConfig, createAdapter, scaffoldFromSchema } from '@runcontext/core';
import type { DataSourceConfig, ColumnInfo } from '@runcontext/core';

function parseDbUrl(db: string): DataSourceConfig {
  if (db.startsWith('duckdb://')) {
    return { adapter: 'duckdb', path: db.slice('duckdb://'.length) };
  }
  if (db.startsWith('postgres://') || db.startsWith('postgresql://')) {
    return { adapter: 'postgres', connection: db };
  }
  // Assume file path = duckdb
  if (db.endsWith('.duckdb') || db.endsWith('.db')) {
    return { adapter: 'duckdb', path: db };
  }
  throw new Error(`Cannot determine adapter from "${db}". Use duckdb:// or postgres:// prefix.`);
}

export const introspectCommand = new Command('introspect')
  .description('Introspect a database and scaffold Bronze-level OSI metadata')
  .option('--db <url>', 'Database URL (e.g., duckdb://path.duckdb or postgres://...)')
  .option('--source <name>', 'Use a named data_source from contextkit.config.yaml')
  .option('--tables <glob>', 'Filter tables by glob pattern (e.g., "vw_*")')
  .option('--model-name <name>', 'Name for the generated model (default: derived from source)')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = path.resolve(config.context_dir);

      // Resolve data source config
      let dsConfig: DataSourceConfig;
      let dsName: string;

      if (opts.db) {
        dsConfig = parseDbUrl(opts.db);
        dsName = opts.source ?? 'default';
      } else if (opts.source) {
        if (!config.data_sources?.[opts.source]) {
          console.error(chalk.red(`Data source "${opts.source}" not found in contextkit.config.yaml`));
          process.exit(1);
        }
        dsConfig = config.data_sources[opts.source];
        dsName = opts.source;
      } else {
        // Use first configured data source
        const sources = config.data_sources;
        if (!sources || Object.keys(sources).length === 0) {
          console.error(chalk.red('No data source specified. Use --db <url> or configure data_sources in contextkit.config.yaml'));
          process.exit(1);
        }
        const firstName = Object.keys(sources)[0];
        dsConfig = sources[firstName];
        dsName = firstName;
      }

      // Connect
      const adapter = await createAdapter(dsConfig);
      await adapter.connect();
      console.log(chalk.green(`Connected to ${dsConfig.adapter}: ${dsConfig.path ?? dsConfig.connection}`));

      // Introspect
      let tables = await adapter.listTables();

      // Filter by glob if specified
      if (opts.tables) {
        const pattern = opts.tables.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        tables = tables.filter((t) => regex.test(t.name));
      }

      console.log(`Discovered ${tables.length} tables/views`);

      // Get columns for each table
      const columns: Record<string, ColumnInfo[]> = {};
      for (const table of tables) {
        columns[table.name] = await adapter.listColumns(table.name);
      }

      const totalCols = Object.values(columns).reduce((sum, cols) => sum + cols.length, 0);
      console.log(`Found ${totalCols} columns total`);

      await adapter.disconnect();

      // Generate model name
      const modelName = opts.modelName ?? dsName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

      // Scaffold
      const result = scaffoldFromSchema({
        modelName,
        dataSourceName: dsName,
        tables,
        columns,
      });

      // Write files
      const dirs = ['models', 'governance', 'owners'];
      for (const dir of dirs) {
        const dirPath = path.join(contextDir, dir);
        if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
      }

      const osiPath = path.join(contextDir, 'models', result.files.osi);
      const govPath = path.join(contextDir, 'governance', result.files.governance);
      const ownerPath = path.join(contextDir, 'owners', result.files.owner);

      writeFileSync(osiPath, result.osiYaml, 'utf-8');
      writeFileSync(govPath, result.governanceYaml, 'utf-8');
      if (!existsSync(ownerPath)) {
        writeFileSync(ownerPath, result.ownerYaml, 'utf-8');
      }

      console.log('');
      console.log(chalk.green('Scaffolded:'));
      console.log(`  ${path.relative(process.cwd(), osiPath)}`);
      console.log(`  ${path.relative(process.cwd(), govPath)}`);
      console.log(`  ${path.relative(process.cwd(), ownerPath)}`);
      console.log('');
      console.log(chalk.cyan('Run `context tier` to check your tier score.'));
      console.log(chalk.cyan('Run `context verify` to validate against data.'));
    } catch (err) {
      console.error(chalk.red(`Introspect failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
```

**Step 2: Register in CLI index**

Add to `packages/cli/src/index.ts`:

```typescript
import { introspectCommand } from './commands/introspect.js';
// ...
program.addCommand(introspectCommand);
```

**Step 3: Build and smoke test**

Run: `cd packages/cli && npm run build`

Run: Create a temp dir with a DuckDB file and run:
```bash
cd /tmp && mkdir ck-test && cd ck-test
echo "context_dir: context" > contextkit.config.yaml
npx context introspect --db duckdb:///Users/erickittelson/Desktop/agent-coffee-thunderdome/warehouse/coffee.duckdb --model-name coffee-warehouse
```
Expected: Files scaffolded, `context tier` shows Bronze

**Step 4: Commit**

```bash
git add packages/cli/src/commands/introspect.ts packages/cli/src/index.ts
git commit -m "feat(cli): add context introspect command"
```

---

### Task 8: Data-Aware Lint Rules (8 rules)

**Files:**
- Create: `packages/core/src/linter/rules/data-source-exists.ts`
- Create: `packages/core/src/linter/rules/data-fields-exist.ts`
- Create: `packages/core/src/linter/rules/data-field-types-compatible.ts`
- Create: `packages/core/src/linter/rules/data-sample-values-accurate.ts`
- Create: `packages/core/src/linter/rules/data-golden-queries-execute.ts`
- Create: `packages/core/src/linter/rules/data-golden-queries-nonempty.ts`
- Create: `packages/core/src/linter/rules/data-guardrails-valid-sql.ts`
- Create: `packages/core/src/linter/rules/data-row-counts-nonzero.ts`
- Modify: `packages/core/src/linter/rules/index.ts` — export new rules
- Test: `packages/core/src/linter/__tests__/data-rules.test.ts`

**Important design note:** Standard lint rules are synchronous (`run(graph): Diagnostic[]`). Data rules need database access, which is async. Two options:

1. Make data rules a separate async category with a new interface
2. Have the `verify` command handle the async DB calls and inject results into the graph

**Recommended: Option 2.** Add an optional `dataValidation` property to `ContextGraph` that the verify command populates before running data rules. The rules themselves stay synchronous — they just read from `graph.dataValidation`.

**Step 1: Extend graph types**

Add to `packages/core/src/types/graph.ts`:

```typescript
export interface DataValidationInfo {
  /** Tables that exist in the DB, mapped to row count */
  existingTables: Map<string, number>;
  /** Columns per table: table -> column name -> data_type */
  existingColumns: Map<string, Map<string, string>>;
  /** Sample values per field: "dataset.field" -> string[] */
  actualSampleValues: Map<string, string[]>;
  /** Golden query results: query index -> { success, error?, rowCount? } */
  goldenQueryResults: Map<number, { success: boolean; error?: string; rowCount?: number }>;
  /** Guardrail filter results: filter index -> { valid, error? } */
  guardrailResults: Map<number, { valid: boolean; error?: string }>;
}

export interface ContextGraph {
  // ... existing fields ...
  dataValidation?: DataValidationInfo;
}
```

**Step 2: Write failing tests for 2 representative rules**

```typescript
// packages/core/src/linter/__tests__/data-rules.test.ts
import { describe, it, expect } from 'vitest';
import { createEmptyGraph } from '../../compiler/graph.js';
import { dataSourceExists } from '../rules/data-source-exists.js';
import { dataFieldsExist } from '../rules/data-fields-exist.js';
import { dataGoldenQueriesExecute } from '../rules/data-golden-queries-execute.js';
import type { DataValidationInfo } from '../../types/graph.js';

function makeDataValidation(overrides: Partial<DataValidationInfo> = {}): DataValidationInfo {
  return {
    existingTables: new Map(),
    existingColumns: new Map(),
    actualSampleValues: new Map(),
    goldenQueryResults: new Map(),
    guardrailResults: new Map(),
    ...overrides,
  };
}

describe('data/source-exists', () => {
  it('returns no diagnostics when skipped (no dataValidation)', () => {
    const graph = createEmptyGraph();
    const diags = dataSourceExists.run(graph);
    expect(diags).toHaveLength(0);
  });

  it('returns error when dataset table not found in DB', () => {
    const graph = createEmptyGraph();
    graph.models.set('test', {
      name: 'test',
      description: 'test',
      datasets: [{ name: 'users', source: 'db.main.users', description: 'Users', fields: [] }],
    } as any);
    graph.dataValidation = makeDataValidation({
      existingTables: new Map([['orders', 50]]),
    });
    const diags = dataSourceExists.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('users');
    expect(diags[0].ruleId).toBe('data/source-exists');
  });

  it('passes when table exists', () => {
    const graph = createEmptyGraph();
    graph.models.set('test', {
      name: 'test',
      description: 'test',
      datasets: [{ name: 'users', source: 'db.main.users', description: 'Users', fields: [] }],
    } as any);
    graph.dataValidation = makeDataValidation({
      existingTables: new Map([['users', 100]]),
    });
    const diags = dataSourceExists.run(graph);
    expect(diags).toHaveLength(0);
  });
});

describe('data/fields-exist', () => {
  it('returns error when field not found as column', () => {
    const graph = createEmptyGraph();
    graph.models.set('test', {
      name: 'test',
      description: 'test',
      datasets: [{
        name: 'users',
        source: 'db.main.users',
        description: 'Users',
        fields: [
          { name: 'user_id', description: 'ID', expression: { dialects: [] } },
          { name: 'dc_key', description: 'Key', expression: { dialects: [] } },
        ],
      }],
    } as any);
    graph.dataValidation = makeDataValidation({
      existingTables: new Map([['users', 100]]),
      existingColumns: new Map([['users', new Map([['user_id', 'INTEGER'], ['incident_id', 'VARCHAR']])]]),
    });
    const diags = dataFieldsExist.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('dc_key');
  });
});

describe('data/golden-queries-execute', () => {
  it('returns error when golden query fails', () => {
    const graph = createEmptyGraph();
    graph.rules.set('test', {
      model: 'test',
      golden_queries: [
        { question: 'Q1', sql: 'SELECT 1' },
        { question: 'Q2', sql: 'SELECT bad' },
      ],
    } as any);
    graph.dataValidation = makeDataValidation({
      goldenQueryResults: new Map([
        [0, { success: true, rowCount: 1 }],
        [1, { success: false, error: 'column "bad" not found' }],
      ]),
    });
    const diags = dataGoldenQueriesExecute.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('Q2');
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run src/linter/__tests__/data-rules.test.ts`
Expected: FAIL

**Step 4: Implement all 8 rules**

```typescript
// packages/core/src/linter/rules/data-source-exists.ts
import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataSourceExists: LintRule = {
  id: 'data/source-exists',
  defaultSeverity: 'error',
  description: "Every dataset's source table must exist in the database",
  fixable: false,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];
    const existing = graph.dataValidation.existingTables;

    for (const [, model] of graph.models) {
      for (const ds of model.datasets) {
        // Extract table name from source (e.g., "warehouse.main.users" -> "users")
        const tableName = ds.source?.split('.').pop() ?? ds.name;
        if (!existing.has(tableName) && !existing.has(ds.name)) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Dataset "${ds.name}" references table "${tableName}" which does not exist in the database`,
            location: { file: `model:${model.name}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }
    return diagnostics;
  },
};
```

```typescript
// packages/core/src/linter/rules/data-fields-exist.ts
import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataFieldsExist: LintRule = {
  id: 'data/fields-exist',
  defaultSeverity: 'error',
  description: 'Every OSI field must exist as a column in the source table',
  fixable: false,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];
    const colMap = graph.dataValidation.existingColumns;

    for (const [, model] of graph.models) {
      for (const ds of model.datasets) {
        const tableName = ds.source?.split('.').pop() ?? ds.name;
        const cols = colMap.get(tableName) ?? colMap.get(ds.name);
        if (!cols) continue;

        for (const field of ds.fields) {
          if (!cols.has(field.name)) {
            diagnostics.push({
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Field "${ds.name}.${field.name}" does not exist as a column in table "${tableName}"`,
              location: { file: `model:${model.name}`, line: 1, column: 1 },
              fixable: false,
            });
          }
        }
      }
    }
    return diagnostics;
  },
};
```

```typescript
// packages/core/src/linter/rules/data-field-types-compatible.ts
import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

const NUMERIC_TYPES = new Set(['INTEGER', 'BIGINT', 'SMALLINT', 'DOUBLE', 'FLOAT', 'REAL', 'DECIMAL', 'NUMERIC', 'numeric', 'integer', 'bigint', 'smallint', 'double precision', 'real']);

export const dataFieldTypesCompatible: LintRule = {
  id: 'data/field-types-compatible',
  defaultSeverity: 'warning',
  description: 'Semantic roles should be compatible with column types (e.g., metric on numeric)',
  fixable: false,
  tier: 'silver',
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];
    const colMap = graph.dataValidation.existingColumns;

    for (const [, gov] of graph.governance) {
      if (!gov.fields) continue;
      for (const [fieldKey, fieldGov] of Object.entries(gov.fields)) {
        if (!fieldGov.semantic_role) continue;
        const [dsName, fieldName] = fieldKey.split('.');
        const cols = colMap.get(dsName);
        if (!cols) continue;
        const colType = cols.get(fieldName);
        if (!colType) continue;

        if (fieldGov.semantic_role === 'metric' && !NUMERIC_TYPES.has(colType)) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Field "${fieldKey}" has semantic_role "metric" but column type is "${colType}" (expected numeric)`,
            location: { file: `governance:${gov.model}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }
    return diagnostics;
  },
};
```

```typescript
// packages/core/src/linter/rules/data-sample-values-accurate.ts
import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataSampleValuesAccurate: LintRule = {
  id: 'data/sample-values-accurate',
  defaultSeverity: 'warning',
  description: 'Governance sample_values should match values actually found in the data',
  fixable: false,
  tier: 'silver',
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];
    const actual = graph.dataValidation.actualSampleValues;

    for (const [, gov] of graph.governance) {
      if (!gov.fields) continue;
      for (const [fieldKey, fieldGov] of Object.entries(gov.fields)) {
        if (!fieldGov.sample_values || fieldGov.sample_values.length === 0) continue;
        const realValues = actual.get(fieldKey);
        if (!realValues) continue;

        const realSet = new Set(realValues);
        const mismatched = fieldGov.sample_values.filter((v: string) => !realSet.has(v));
        if (mismatched.length > 0) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Field "${fieldKey}" has sample_values not found in data: ${mismatched.join(', ')}`,
            location: { file: `governance:${gov.model}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }
    return diagnostics;
  },
};
```

```typescript
// packages/core/src/linter/rules/data-golden-queries-execute.ts
import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataGoldenQueriesExecute: LintRule = {
  id: 'data/golden-queries-execute',
  defaultSeverity: 'error',
  description: 'Every golden query must execute without errors',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];
    const results = graph.dataValidation.goldenQueryResults;

    for (const [, rules] of graph.rules) {
      if (!rules.golden_queries) continue;
      rules.golden_queries.forEach((gq: any, idx: number) => {
        const result = results.get(idx);
        if (result && !result.success) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Golden query "${gq.question}" failed: ${result.error}`,
            location: { file: `rules:${rules.model}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      });
    }
    return diagnostics;
  },
};
```

```typescript
// packages/core/src/linter/rules/data-golden-queries-nonempty.ts
import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataGoldenQueriesNonempty: LintRule = {
  id: 'data/golden-queries-nonempty',
  defaultSeverity: 'warning',
  description: 'Golden queries should return at least one row',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];
    const results = graph.dataValidation.goldenQueryResults;

    for (const [, rules] of graph.rules) {
      if (!rules.golden_queries) continue;
      rules.golden_queries.forEach((gq: any, idx: number) => {
        const result = results.get(idx);
        if (result && result.success && result.rowCount === 0) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Golden query "${gq.question}" returned 0 rows`,
            location: { file: `rules:${rules.model}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      });
    }
    return diagnostics;
  },
};
```

```typescript
// packages/core/src/linter/rules/data-guardrails-valid-sql.ts
import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataGuardrailsValidSql: LintRule = {
  id: 'data/guardrails-valid-sql',
  defaultSeverity: 'error',
  description: 'Guardrail filters must be valid SQL fragments',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];
    const results = graph.dataValidation.guardrailResults;

    for (const [, rules] of graph.rules) {
      if (!rules.guardrail_filters) continue;
      rules.guardrail_filters.forEach((gf: any, idx: number) => {
        const result = results.get(idx);
        if (result && !result.valid) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Guardrail "${gf.name}" has invalid SQL filter: ${result.error}`,
            location: { file: `rules:${rules.model}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      });
    }
    return diagnostics;
  },
};
```

```typescript
// packages/core/src/linter/rules/data-row-counts-nonzero.ts
import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataRowCountsNonzero: LintRule = {
  id: 'data/row-counts-nonzero',
  defaultSeverity: 'warning',
  description: 'Referenced tables should contain data',
  fixable: false,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];
    const existing = graph.dataValidation.existingTables;

    for (const [, model] of graph.models) {
      for (const ds of model.datasets) {
        const tableName = ds.source?.split('.').pop() ?? ds.name;
        const rowCount = existing.get(tableName) ?? existing.get(ds.name);
        if (rowCount === 0) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Dataset "${ds.name}" (table "${tableName}") has 0 rows`,
            location: { file: `model:${model.name}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }
    return diagnostics;
  },
};
```

**Step 5: Register rules in rules/index.ts**

Add to `packages/core/src/linter/rules/index.ts`:

```typescript
import { dataSourceExists } from './data-source-exists.js';
import { dataFieldsExist } from './data-fields-exist.js';
import { dataFieldTypesCompatible } from './data-field-types-compatible.js';
import { dataSampleValuesAccurate } from './data-sample-values-accurate.js';
import { dataGoldenQueriesExecute } from './data-golden-queries-execute.js';
import { dataGoldenQueriesNonempty } from './data-golden-queries-nonempty.js';
import { dataGuardrailsValidSql } from './data-guardrails-valid-sql.js';
import { dataRowCountsNonzero } from './data-row-counts-nonzero.js';

// Add to ALL_RULES array:
export const ALL_RULES: LintRule[] = [
  // ... existing rules ...
  dataSourceExists,
  dataFieldsExist,
  dataFieldTypesCompatible,
  dataSampleValuesAccurate,
  dataGoldenQueriesExecute,
  dataGoldenQueriesNonempty,
  dataGuardrailsValidSql,
  dataRowCountsNonzero,
];
```

**Step 6: Run tests**

Run: `cd packages/core && npx vitest run src/linter/__tests__/data-rules.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/core/src/linter/rules/data-*.ts packages/core/src/linter/rules/index.ts packages/core/src/linter/__tests__/data-rules.test.ts packages/core/src/types/graph.ts
git commit -m "feat(core): add 8 data-aware lint rules"
```

---

### Task 9: `context verify` CLI Command

**Files:**
- Create: `packages/cli/src/commands/verify.ts`
- Modify: `packages/cli/src/index.ts` — register the command

**Step 1: Implement verify command**

The verify command:
1. Compiles the context graph
2. Connects to the database(s)
3. Runs introspection queries to populate `graph.dataValidation`
4. Runs lint engine with data rules
5. Reports results

```typescript
// packages/cli/src/commands/verify.ts
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
  compile,
  loadConfigAsync,
  createAdapter,
  LintEngine,
  ALL_RULES,
  type DataAdapter,
  type DataValidationInfo,
  type ContextGraph,
} from '@runcontext/core';
import { formatDiagnostics } from '../formatters/pretty.js';

async function collectDataValidation(
  adapter: DataAdapter,
  graph: ContextGraph,
): Promise<DataValidationInfo> {
  const validation: DataValidationInfo = {
    existingTables: new Map(),
    existingColumns: new Map(),
    actualSampleValues: new Map(),
    goldenQueryResults: new Map(),
    guardrailResults: new Map(),
  };

  // List all tables with row counts
  const tables = await adapter.listTables();
  for (const t of tables) {
    validation.existingTables.set(t.name, t.row_count);
  }

  // List columns for all tables
  for (const t of tables) {
    const cols = await adapter.listColumns(t.name);
    const colMap = new Map(cols.map((c) => [c.name, c.data_type]));
    validation.existingColumns.set(t.name, colMap);
  }

  // Collect sample values for fields that have them in governance
  for (const [, gov] of graph.governance) {
    if (!gov.fields) continue;
    for (const [fieldKey, fieldGov] of Object.entries(gov.fields)) {
      if (!fieldGov.sample_values || fieldGov.sample_values.length === 0) continue;
      const [dsName, fieldName] = fieldKey.split('.');

      // Find matching table
      const tableName = findTable(dsName, graph, validation.existingTables);
      if (!tableName) continue;

      try {
        const result = await adapter.query(
          `SELECT DISTINCT CAST("${fieldName}" AS VARCHAR) AS val FROM "${tableName}" WHERE "${fieldName}" IS NOT NULL LIMIT 50`,
        );
        validation.actualSampleValues.set(fieldKey, result.rows.map((r) => String(r.val)));
      } catch {
        // skip — column might not exist
      }
    }
  }

  // Execute golden queries
  for (const [, rules] of graph.rules) {
    if (!rules.golden_queries) continue;
    for (let i = 0; i < rules.golden_queries.length; i++) {
      const gq = rules.golden_queries[i];
      try {
        const result = await adapter.query(gq.sql);
        validation.goldenQueryResults.set(i, { success: true, rowCount: result.row_count });
      } catch (err) {
        validation.goldenQueryResults.set(i, {
          success: false,
          error: (err as Error).message,
        });
      }
    }
  }

  // Validate guardrail filters
  for (const [, rules] of graph.rules) {
    if (!rules.guardrail_filters) continue;
    for (let i = 0; i < rules.guardrail_filters.length; i++) {
      const gf = rules.guardrail_filters[i];
      // Test filter by wrapping in a SELECT
      const testTable = gf.tables?.[0] ?? 'unknown';
      const tableName = findTable(testTable, graph, validation.existingTables);
      if (!tableName) {
        validation.guardrailResults.set(i, { valid: false, error: `Table "${testTable}" not found` });
        continue;
      }
      try {
        await adapter.query(`SELECT 1 FROM "${tableName}" WHERE ${gf.filter} LIMIT 1`);
        validation.guardrailResults.set(i, { valid: true });
      } catch (err) {
        validation.guardrailResults.set(i, { valid: false, error: (err as Error).message });
      }
    }
  }

  return validation;
}

function findTable(
  dsName: string,
  graph: ContextGraph,
  existingTables: Map<string, number>,
): string | undefined {
  // Try direct match
  if (existingTables.has(dsName)) return dsName;

  // Try to find via model dataset source
  for (const [, model] of graph.models) {
    const ds = model.datasets.find((d) => d.name === dsName);
    if (ds?.source) {
      const tableName = ds.source.split('.').pop()!;
      if (existingTables.has(tableName)) return tableName;
    }
  }
  return undefined;
}

export const verifyCommand = new Command('verify')
  .description('Validate metadata accuracy against a live database')
  .option('--source <name>', 'Use a specific data_source from config')
  .option('--db <url>', 'Database URL override')
  .action(async (opts) => {
    try {
      const config = await loadConfigAsync(process.cwd());
      const contextDir = path.resolve(config.context_dir);

      // Compile graph
      const { graph, diagnostics: compileDiags, directives } = await compile({
        contextDir,
        config,
        rootDir: process.cwd(),
      });

      // Resolve data source
      let dsConfig: any;
      if (opts.db) {
        const { parseDbUrl } = await import('./introspect.js');
        dsConfig = parseDbUrl(opts.db);
      } else {
        const sources = config.data_sources;
        if (!sources || Object.keys(sources).length === 0) {
          console.error(chalk.red('No data source configured. Use --db <url> or add data_sources to contextkit.config.yaml'));
          process.exit(1);
        }
        const name = opts.source ?? Object.keys(sources)[0];
        dsConfig = sources[name];
        if (!dsConfig) {
          console.error(chalk.red(`Data source "${name}" not found in config`));
          process.exit(1);
        }
      }

      // Connect and collect validation data
      const adapter = await createAdapter(dsConfig);
      await adapter.connect();
      console.log(chalk.green(`Connected to ${dsConfig.adapter}`));
      console.log('Collecting validation data...\n');

      graph.dataValidation = await collectDataValidation(adapter, graph);
      await adapter.disconnect();

      // Run only data/* rules
      const engine = new LintEngine();
      for (const rule of ALL_RULES) {
        if (rule.id.startsWith('data/')) {
          engine.register(rule);
        }
      }
      const dataDiags = engine.run(graph);

      // Output
      if (dataDiags.length === 0) {
        console.log(chalk.green('All data validation checks passed.\n'));

        // Print summary
        const tableCount = graph.dataValidation!.existingTables.size;
        const totalRows = [...graph.dataValidation!.existingTables.values()].reduce((a, b) => a + b, 0);
        console.log(`Verified against ${tableCount} tables (${totalRows.toLocaleString()} total rows)`);
      } else {
        console.log(formatDiagnostics(dataDiags));
      }

      const hasErrors = dataDiags.some((d) => d.severity === 'error');
      if (hasErrors) process.exit(1);
    } catch (err) {
      console.error(chalk.red(`Verify failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
```

Note: Export `parseDbUrl` from introspect.ts so verify can reuse it. Change `introspect.ts` to add:
```typescript
export function parseDbUrl(db: string): DataSourceConfig { ... }
```

**Step 2: Register in CLI index**

Add to `packages/cli/src/index.ts`:

```typescript
import { verifyCommand } from './commands/verify.js';
program.addCommand(verifyCommand);
```

**Step 3: Commit**

```bash
git add packages/cli/src/commands/verify.ts packages/cli/src/index.ts
git commit -m "feat(cli): add context verify command"
```

---

### Task 10: Enrich Module

**Files:**
- Create: `packages/core/src/introspect/enrich.ts`
- Test: `packages/core/src/introspect/__tests__/enrich.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/src/introspect/__tests__/enrich.test.ts
import { describe, it, expect } from 'vitest';
import { suggestEnrichments } from '../enrich.js';
import type { TierScore } from '../../types/tier.js';

describe('suggestEnrichments', () => {
  it('suggests trust, tags, lineage for silver target', () => {
    const tierScore: TierScore = {
      tier: 'bronze',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: {
        passed: false,
        checks: [
          { name: 'Trust status is set', passed: false },
          { name: 'At least 2 tags', passed: false },
          { name: 'Glossary term linked', passed: false },
          { name: 'Upstream lineage exists', passed: false },
          { name: 'All datasets have refresh cadence', passed: false },
          { name: 'At least 2 fields have sample_values', passed: false },
        ],
      },
      gold: { passed: false, checks: [] },
    };
    const suggestions = suggestEnrichments('silver', tierScore, ['users', 'orders']);
    expect(suggestions.governance).toBeDefined();
    expect(suggestions.governance!.trust).toBe('endorsed');
    expect(suggestions.governance!.tags?.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.lineage).toBeDefined();
    expect(suggestions.lineage!.upstream?.length).toBeGreaterThanOrEqual(1);
  });

  it('suggests semantic_roles and rules for gold target', () => {
    const tierScore: TierScore = {
      tier: 'silver',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: { passed: true, checks: [] },
      gold: {
        passed: false,
        checks: [
          { name: 'Every field has semantic_role', passed: false },
          { name: 'At least 3 golden_queries exist', passed: false },
          { name: 'At least 1 guardrail_filter exists', passed: false },
          { name: 'At least 1 business_rule exists', passed: false },
          { name: 'At least 1 hierarchy exists', passed: false },
        ],
      },
    };
    const suggestions = suggestEnrichments('gold', tierScore, ['users']);
    expect(suggestions.needsRulesFile).toBe(true);
  });

  it('returns empty suggestions when already at target', () => {
    const tierScore: TierScore = {
      tier: 'gold',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: { passed: true, checks: [] },
      gold: { passed: true, checks: [] },
    };
    const suggestions = suggestEnrichments('gold', tierScore, []);
    expect(suggestions.governance).toBeUndefined();
    expect(suggestions.lineage).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/introspect/__tests__/enrich.test.ts`
Expected: FAIL

**Step 3: Implement enrich module**

```typescript
// packages/core/src/introspect/enrich.ts
import type { TierScore, MetadataTier } from '../types/tier.js';

export interface EnrichResult {
  governance?: {
    trust?: string;
    tags?: string[];
    refreshAll?: string;
  };
  lineage?: {
    upstream?: Array<{ source: string; type: string; notes: string }>;
  };
  glossaryTerms?: Array<{ id: string; definition: string; owner: string }>;
  needsRulesFile?: boolean;
  needsSampleValues?: boolean;
  needsSemanticRoles?: boolean;
}

const TIER_ORDER: MetadataTier[] = ['none', 'bronze', 'silver', 'gold'];

export function suggestEnrichments(
  target: MetadataTier,
  tierScore: TierScore,
  datasetNames: string[],
): EnrichResult {
  const currentIdx = TIER_ORDER.indexOf(tierScore.tier);
  const targetIdx = TIER_ORDER.indexOf(target);

  if (currentIdx >= targetIdx) return {};

  const result: EnrichResult = {};

  // Silver suggestions
  if (targetIdx >= TIER_ORDER.indexOf('silver') && !tierScore.silver.passed) {
    const failedChecks = tierScore.silver.checks
      .filter((c) => !c.passed)
      .map((c) => c.name);

    if (failedChecks.some((c) => c.includes('Trust'))) {
      result.governance = result.governance ?? {};
      result.governance.trust = 'endorsed';
    }

    if (failedChecks.some((c) => c.includes('tags'))) {
      result.governance = result.governance ?? {};
      result.governance.tags = datasetNames.length > 0
        ? [datasetNames[0].replace(/_/g, '-'), 'analytics']
        : ['analytics', 'data'];
    }

    if (failedChecks.some((c) => c.includes('lineage'))) {
      result.lineage = {
        upstream: datasetNames.map((ds) => ({
          source: ds,
          type: 'pipeline',
          notes: `Upstream source for ${ds}`,
        })),
      };
    }

    if (failedChecks.some((c) => c.includes('refresh'))) {
      result.governance = result.governance ?? {};
      result.governance.refreshAll = 'daily';
    }

    if (failedChecks.some((c) => c.includes('Glossary'))) {
      result.glossaryTerms = [{
        id: datasetNames[0]?.replace(/_/g, '-') ?? 'term',
        definition: `Definition for ${datasetNames[0] ?? 'entity'}`,
        owner: 'default-team',
      }];
    }

    if (failedChecks.some((c) => c.includes('sample_values'))) {
      result.needsSampleValues = true;
    }
  }

  // Gold suggestions
  if (targetIdx >= TIER_ORDER.indexOf('gold') && !tierScore.gold.passed) {
    const failedChecks = tierScore.gold.checks
      .filter((c) => !c.passed)
      .map((c) => c.name);

    if (failedChecks.some((c) => c.includes('semantic_role'))) {
      result.needsSemanticRoles = true;
    }

    if (failedChecks.some((c) =>
      c.includes('golden_queries') || c.includes('guardrail') ||
      c.includes('business_rule') || c.includes('hierarch'),
    )) {
      result.needsRulesFile = true;
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/introspect/__tests__/enrich.test.ts`
Expected: PASS

**Step 5: Update introspect/index.ts to export enrich**

Add to `packages/core/src/introspect/index.ts`:
```typescript
export { suggestEnrichments, type EnrichResult } from './enrich.js';
```

**Step 6: Commit**

```bash
git add packages/core/src/introspect/enrich.ts packages/core/src/introspect/__tests__/enrich.test.ts packages/core/src/introspect/index.ts
git commit -m "feat(core): add enrich module for tier promotion suggestions"
```

---

### Task 11: `context enrich` CLI Command

**Files:**
- Create: `packages/cli/src/commands/enrich.ts`
- Modify: `packages/cli/src/index.ts` — register the command

**Step 1: Implement the command**

```typescript
// packages/cli/src/commands/enrich.ts
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import * as yaml from 'yaml';
import {
  compile,
  loadConfig,
  computeTier,
  suggestEnrichments,
  createAdapter,
  inferSemanticRole,
  inferAggregation,
  type MetadataTier,
} from '@runcontext/core';

export const enrichCommand = new Command('enrich')
  .description('Suggest or apply metadata enrichments to reach a target tier')
  .option('--target <tier>', 'Target tier: silver or gold', 'silver')
  .option('--apply', 'Write suggestions to YAML files')
  .option('--source <name>', 'Data source for sample values')
  .option('--db <url>', 'Database URL for sample values')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = path.resolve(config.context_dir);
      const target = opts.target as MetadataTier;

      if (!['silver', 'gold'].includes(target)) {
        console.error(chalk.red('--target must be "silver" or "gold"'));
        process.exit(1);
      }

      const { graph } = await compile({ contextDir, config, rootDir: process.cwd() });

      for (const [modelName] of graph.models) {
        const tierScore = computeTier(modelName, graph);
        console.log(chalk.bold(`${modelName}: ${tierScore.tier.toUpperCase()}`));

        if (tierScore.tier === target || (target === 'silver' && tierScore.tier === 'gold')) {
          console.log(chalk.green(`  Already at ${target} or above.\n`));
          continue;
        }

        const model = graph.models.get(modelName)!;
        const datasetNames = model.datasets.map((d) => d.name);
        const suggestions = suggestEnrichments(target, tierScore, datasetNames);

        if (!suggestions.governance && !suggestions.lineage && !suggestions.glossaryTerms && !suggestions.needsRulesFile) {
          console.log(chalk.green('  No suggestions needed.\n'));
          continue;
        }

        // Report suggestions
        if (suggestions.governance?.trust) {
          console.log(chalk.yellow(`  + Add trust: ${suggestions.governance.trust}`));
        }
        if (suggestions.governance?.tags) {
          console.log(chalk.yellow(`  + Add tags: [${suggestions.governance.tags.join(', ')}]`));
        }
        if (suggestions.governance?.refreshAll) {
          console.log(chalk.yellow(`  + Add refresh: ${suggestions.governance.refreshAll} to all datasets`));
        }
        if (suggestions.lineage) {
          console.log(chalk.yellow(`  + Add lineage with ${suggestions.lineage.upstream?.length} upstream sources`));
        }
        if (suggestions.glossaryTerms) {
          console.log(chalk.yellow(`  + Generate ${suggestions.glossaryTerms.length} glossary term(s)`));
        }
        if (suggestions.needsSampleValues) {
          console.log(chalk.yellow('  + Populate sample_values from database'));
        }
        if (suggestions.needsSemanticRoles) {
          console.log(chalk.yellow('  + Infer semantic_role for all fields'));
        }
        if (suggestions.needsRulesFile) {
          console.log(chalk.yellow('  + Generate rules file (golden queries, guardrails, business rules, hierarchies)'));
        }

        if (!opts.apply) {
          console.log(chalk.cyan('\n  Run with --apply to write these changes.\n'));
          continue;
        }

        // Apply suggestions
        const govKey = graph.indexes.modelToGovernance.get(modelName);
        if (govKey) {
          const sourceInfo = graph.sourceMap.get(`governance:${govKey}`);
          if (sourceInfo) {
            const govContent = readFileSync(sourceInfo.filePath, 'utf-8');
            const govDoc = yaml.parse(govContent) ?? {};

            if (suggestions.governance?.trust) govDoc.trust = suggestions.governance.trust;
            if (suggestions.governance?.tags) govDoc.tags = suggestions.governance.tags;
            if (suggestions.governance?.refreshAll) {
              for (const dsName of Object.keys(govDoc.datasets ?? {})) {
                govDoc.datasets[dsName].refresh = suggestions.governance.refreshAll;
              }
            }

            // Infer semantic roles if needed
            if (suggestions.needsSemanticRoles) {
              govDoc.fields = govDoc.fields ?? {};
              // Get columns from DB if available
              let adapter: any = null;
              const dsConfig = opts.db
                ? (await import('./introspect.js')).parseDbUrl(opts.db)
                : config.data_sources?.[opts.source ?? Object.keys(config.data_sources ?? {})[0]];

              if (dsConfig) {
                adapter = await createAdapter(dsConfig);
                await adapter.connect();
              }

              for (const ds of model.datasets) {
                let columns: any[] = [];
                if (adapter) {
                  const tableName = ds.source?.split('.').pop() ?? ds.name;
                  try { columns = await adapter.listColumns(tableName); } catch {}
                }

                for (const field of ds.fields) {
                  const fieldKey = `${ds.name}.${field.name}`;
                  if (govDoc.fields[fieldKey]?.semantic_role) continue;

                  const col = columns.find((c: any) => c.name === field.name);
                  const isPK = col?.is_primary_key ?? field.name.endsWith('_id');
                  const dataType = col?.data_type ?? 'VARCHAR';

                  govDoc.fields[fieldKey] = govDoc.fields[fieldKey] ?? {};
                  const role = inferSemanticRole(field.name, dataType, isPK);
                  govDoc.fields[fieldKey].semantic_role = role;

                  if (role === 'metric') {
                    govDoc.fields[fieldKey].default_aggregation = inferAggregation(field.name);
                    govDoc.fields[fieldKey].additive = govDoc.fields[fieldKey].default_aggregation === 'SUM';
                  }
                }
              }

              if (adapter) await adapter.disconnect();
            }

            // Populate sample values if needed
            if (suggestions.needsSampleValues) {
              govDoc.fields = govDoc.fields ?? {};
              const dsConfig2 = opts.db
                ? (await import('./introspect.js')).parseDbUrl(opts.db)
                : config.data_sources?.[opts.source ?? Object.keys(config.data_sources ?? {})[0]];

              if (dsConfig2) {
                const adapter2 = await createAdapter(dsConfig2);
                await adapter2.connect();
                let count = 0;
                for (const ds of model.datasets) {
                  if (count >= 2) break;
                  const tableName = ds.source?.split('.').pop() ?? ds.name;
                  for (const field of ds.fields) {
                    if (count >= 2) break;
                    const fieldKey = `${ds.name}.${field.name}`;
                    if (govDoc.fields[fieldKey]?.sample_values?.length > 0) continue;
                    try {
                      const result = await adapter2.query(
                        `SELECT DISTINCT CAST("${field.name}" AS VARCHAR) AS val FROM "${tableName}" WHERE "${field.name}" IS NOT NULL LIMIT 5`,
                      );
                      if (result.rows.length > 0) {
                        govDoc.fields[fieldKey] = govDoc.fields[fieldKey] ?? {};
                        govDoc.fields[fieldKey].sample_values = result.rows.map((r: any) => String(r.val));
                        count++;
                      }
                    } catch {}
                  }
                }
                await adapter2.disconnect();
              }
            }

            writeFileSync(sourceInfo.filePath, yaml.stringify(govDoc, { lineWidth: 120 }), 'utf-8');
            console.log(chalk.green(`  Updated: ${path.relative(process.cwd(), sourceInfo.filePath)}`));
          }
        }

        // Write lineage file if needed
        if (suggestions.lineage) {
          const lineageDir = path.join(contextDir, 'lineage');
          if (!existsSync(lineageDir)) mkdirSync(lineageDir, { recursive: true });
          const lineagePath = path.join(lineageDir, `${modelName}.lineage.yaml`);
          if (!existsSync(lineagePath)) {
            const lineageDoc = { model: modelName, upstream: suggestions.lineage.upstream };
            writeFileSync(lineagePath, yaml.stringify(lineageDoc, { lineWidth: 120 }), 'utf-8');
            console.log(chalk.green(`  Created: ${path.relative(process.cwd(), lineagePath)}`));
          }
        }

        // Write glossary terms if needed
        if (suggestions.glossaryTerms) {
          const glossaryDir = path.join(contextDir, 'glossary');
          if (!existsSync(glossaryDir)) mkdirSync(glossaryDir, { recursive: true });
          for (const term of suggestions.glossaryTerms) {
            const termPath = path.join(glossaryDir, `${term.id}.term.yaml`);
            if (!existsSync(termPath)) {
              writeFileSync(termPath, yaml.stringify(term, { lineWidth: 120 }), 'utf-8');
              console.log(chalk.green(`  Created: ${path.relative(process.cwd(), termPath)}`));
            }
          }
        }

        // Stub rules file if needed
        if (suggestions.needsRulesFile) {
          const rulesDir = path.join(contextDir, 'rules');
          if (!existsSync(rulesDir)) mkdirSync(rulesDir, { recursive: true });
          const rulesPath = path.join(rulesDir, `${modelName}.rules.yaml`);
          if (!existsSync(rulesPath)) {
            const rulesDoc = {
              model: modelName,
              golden_queries: [
                { question: 'TODO: What is the total count?', sql: 'SELECT COUNT(*) FROM table_name' },
                { question: 'TODO: What are the top records?', sql: 'SELECT * FROM table_name LIMIT 10' },
                { question: 'TODO: What is the distribution?', sql: 'SELECT column, COUNT(*) FROM table_name GROUP BY column' },
              ],
              business_rules: [
                { name: 'TODO: rule-name', definition: 'TODO: describe the business rule' },
              ],
              guardrail_filters: [
                { name: 'TODO: filter-name', filter: 'column IS NOT NULL', reason: 'TODO: explain why' },
              ],
              hierarchies: [
                { name: 'TODO: hierarchy-name', levels: ['level1', 'level2'], dataset: datasetNames[0] ?? 'dataset' },
              ],
            };
            writeFileSync(rulesPath, yaml.stringify(rulesDoc, { lineWidth: 120 }), 'utf-8');
            console.log(chalk.green(`  Created: ${path.relative(process.cwd(), rulesPath)} (with TODOs to fill in)`));
          }
        }

        console.log('');
      }
    } catch (err) {
      console.error(chalk.red(`Enrich failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
```

**Step 2: Register in CLI index**

Add to `packages/cli/src/index.ts`:

```typescript
import { enrichCommand } from './commands/enrich.js';
program.addCommand(enrichCommand);
```

**Step 3: Commit**

```bash
git add packages/cli/src/commands/enrich.ts packages/cli/src/index.ts
git commit -m "feat(cli): add context enrich command for tier promotion"
```

---

### Task 12: Core Exports and Build

**Files:**
- Modify: `packages/core/src/index.ts` — export new modules

**Step 1: Add exports**

Ensure these are exported from `packages/core/src/index.ts`:

```typescript
// Adapters
export { createAdapter } from './adapters/index.js';
export type { DataAdapter, DataSourceConfig, TableInfo, ColumnInfo, QueryResult } from './adapters/types.js';

// Introspect
export { scaffoldFromSchema } from './introspect/scaffold.js';
export { suggestEnrichments } from './introspect/enrich.js';
export { inferSemanticRole, inferAggregation, inferTableType, inferGrain } from './introspect/heuristics.js';
```

Also export `DataValidationInfo` from types:

```typescript
export type { DataValidationInfo } from './types/graph.js';
```

**Step 2: Build all packages**

Run: `cd /Users/erickittelson/Desktop/ContextKit && pnpm -r run build`
Expected: All packages build without errors

**Step 3: Run all tests**

Run: `cd /Users/erickittelson/Desktop/ContextKit && pnpm -r run test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export adapters, introspect, and data validation types"
```

---

### Task 13: Integration Test — End-to-End with DuckDB

**Files:**
- Create: `packages/cli/src/__tests__/introspect-e2e.test.ts`

**Step 1: Write integration test**

```typescript
// packages/cli/src/__tests__/introspect-e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createAdapter, scaffoldFromSchema, compile, computeTier } from '@runcontext/core';

let tmpDir: string;
let dbPath: string;

// Skip if duckdb not installed
let available = true;
try {
  await import('duckdb');
} catch {
  available = false;
}

if (!available) {
  describe.skip('E2E introspect (duckdb not installed)', () => {
    it('skipped', () => {});
  });
} else {
  describe('E2E: introspect → scaffold → tier → verify', () => {
    beforeAll(async () => {
      tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ck-e2e-'));

      // Create a DuckDB database with test data
      const adapter = await createAdapter({ adapter: 'duckdb', path: ':memory:' });
      await adapter.connect();
      await adapter.query(`CREATE TABLE products (product_id VARCHAR PRIMARY KEY, name VARCHAR, price DOUBLE, category VARCHAR)`);
      await adapter.query(`INSERT INTO products VALUES ('p1','Latte',4.50,'Coffee'),('p2','Muffin',3.00,'Food')`);
      await adapter.query(`CREATE TABLE orders (order_id VARCHAR PRIMARY KEY, product_id VARCHAR, quantity INTEGER, total DOUBLE, order_date DATE)`);
      await adapter.query(`INSERT INTO orders VALUES ('o1','p1',2,9.00,'2024-01-01'),('o2','p2',1,3.00,'2024-01-02')`);

      // Save to file
      dbPath = path.join(tmpDir, 'test.duckdb');
      await adapter.query(`EXPORT DATABASE '${tmpDir}/export'`);
      await adapter.disconnect();

      // Re-create as file DB
      const fileAdapter = await createAdapter({ adapter: 'duckdb', path: ':memory:' });
      await fileAdapter.connect();
      await fileAdapter.query(`CREATE TABLE products (product_id VARCHAR PRIMARY KEY, name VARCHAR, price DOUBLE, category VARCHAR)`);
      await fileAdapter.query(`INSERT INTO products VALUES ('p1','Latte',4.50,'Coffee'),('p2','Muffin',3.00,'Food')`);
      await fileAdapter.query(`CREATE TABLE orders (order_id VARCHAR PRIMARY KEY, product_id VARCHAR, quantity INTEGER, total DOUBLE, order_date DATE)`);
      await fileAdapter.query(`INSERT INTO orders VALUES ('o1','p1',2,9.00,'2024-01-01'),('o2','p2',1,3.00,'2024-01-02')`);

      // Introspect
      const tables = await fileAdapter.listTables();
      const columns: Record<string, any[]> = {};
      for (const t of tables) {
        columns[t.name] = await fileAdapter.listColumns(t.name);
      }
      await fileAdapter.disconnect();

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
      writeFileSync(path.join(contextDir, 'governance', result.files.governance), result.governanceYaml);
      writeFileSync(path.join(contextDir, 'owners', result.files.owner), result.ownerYaml);

      // Write config
      writeFileSync(path.join(tmpDir, 'contextkit.config.yaml'), 'context_dir: context\noutput_dir: dist\n');
    });

    afterAll(() => {
      if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    });

    it('scaffolded files pass Bronze tier', async () => {
      const { graph } = await compile({
        contextDir: path.join(tmpDir, 'context'),
        rootDir: tmpDir,
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
```

**Step 2: Run test**

Run: `cd packages/core && npx vitest run src/__tests__/introspect-e2e.test.ts`

Note: Adjust the test file location to wherever it makes sense — could be `packages/cli/src/__tests__/` if importing CLI-level code.

Expected: PASS

**Step 3: Commit**

```bash
git add packages/cli/src/__tests__/introspect-e2e.test.ts
git commit -m "test: add E2E integration test for introspect → scaffold → tier"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Adapter types + factory | `adapters/types.ts`, `adapters/index.ts` |
| 2 | DuckDB adapter | `adapters/duckdb.ts` |
| 3 | Postgres adapter | `adapters/postgres.ts` |
| 4 | Config schema extension | `types/config.ts`, `schema/config.ts` |
| 5 | Introspection heuristics | `introspect/heuristics.ts` |
| 6 | Scaffold module | `introspect/scaffold.ts` |
| 7 | `context introspect` CLI | `cli/commands/introspect.ts` |
| 8 | 8 data-aware lint rules | `linter/rules/data-*.ts` |
| 9 | `context verify` CLI | `cli/commands/verify.ts` |
| 10 | Enrich module | `introspect/enrich.ts` |
| 11 | `context enrich` CLI | `cli/commands/enrich.ts` |
| 12 | Core exports + build | `core/index.ts` |
| 13 | E2E integration test | `cli/__tests__/introspect-e2e.test.ts` |
