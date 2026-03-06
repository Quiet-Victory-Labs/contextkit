# Data-Aware ContextKit Design

**Goal:** Enable ContextKit to connect to real databases, scaffold OSI metadata from actual schemas, validate metadata accuracy against live data, and iteratively promote models through Bronze/Silver/Gold tiers with data-backed confidence.

**Architecture:** New adapter module in `@runcontext/core` with DuckDB and Postgres drivers. Three new CLI commands (`introspect`, `verify`, `enrich`) use adapters to bridge metadata and data. Data-aware validation plugs into the existing lint engine as a new `data/*` rule category.

**Tech Stack:** DuckDB (`duckdb` npm), Postgres (`pg` npm) as optional peer dependencies. Dynamic imports so ContextKit works without them installed.

---

## Adapter Interface

Minimal 5-method interface covering all data operations:

```typescript
interface DataAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTables(): Promise<TableInfo[]>;
  listColumns(table: string): Promise<ColumnInfo[]>;
  query(sql: string): Promise<QueryResult>;
}

interface TableInfo {
  name: string;
  type: 'table' | 'view';
  schema?: string;
  row_count: number;
}

interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
}
```

Two implementations: `DuckDBAdapter` and `PostgresAdapter`. Both are optional peer deps with dynamic `import()` so the app doesn't crash if they aren't installed.

## Config Extension

New `data_sources` section in `contextkit.config.yaml`:

```yaml
context_dir: context
output_dir: dist

data_sources:
  warehouse:
    adapter: duckdb
    path: ../warehouse/coffee.duckdb
  # analytics:
  #   adapter: postgres
  #   connection: postgresql://user:pass@localhost:5432/analytics
```

Each OSI dataset gets a new optional `data_source` field linking it to a configured source:

```yaml
datasets:
  - name: coffee_shops
    source: warehouse.main.vw_coffee_shops
    data_source: warehouse
```

## CLI Commands

### `context introspect`

Reads DB schema, scaffolds Bronze-level YAML.

```
context introspect --db duckdb://warehouse/coffee.duckdb
context introspect --source warehouse
context introspect --source warehouse --tables "vw_*"
```

Steps:
1. Connect to DB, call `listTables()` and `listColumns()` for each
2. Generate `*.osi.yaml` with all datasets/fields (descriptions set to column names as placeholders)
3. Generate `*.governance.yaml` with owner, security, grain (inferred from PKs), table_type (inferred from name heuristics)
4. Generate `*.owner.yaml` with a default team
5. Write `data_source` references into each dataset
6. Result: files that pass Bronze tier checks

### `context verify`

Validates metadata against real data.

```
context verify
context verify --source warehouse
context verify --fix
```

Checks:
- Every dataset's source table exists in the DB
- Every OSI field exists as a column
- Field types are compatible with semantic roles
- `sample_values` match real data
- Golden queries execute without errors and return rows
- Guardrail filters are valid SQL

With `--fix`: corrects column names, populates sample_values, removes nonexistent fields.

### `context enrich`

Suggests metadata to promote tiers.

```
context enrich --target silver
context enrich --target gold
context enrich --target gold --apply
```

For Silver gaps: generates lineage stubs, suggests tags, queries DB for sample_values, generates glossary terms.

For Gold gaps: infers semantic_role from column types/names, suggests default_aggregation for metrics, generates golden query templates from views, suggests guardrail filters based on NULL rates and outliers.

## Data-Aware Lint Rules

Plugs into the existing lint engine. Rules only run when `data_sources` is configured.

| Rule ID | Tier | What it checks |
|---------|------|----------------|
| `data/source-exists` | Bronze | Dataset's source table exists in the DB |
| `data/fields-exist` | Bronze | Every OSI field exists as a column |
| `data/field-types-compatible` | Silver | Semantic roles make sense for column types |
| `data/sample-values-accurate` | Silver | Governance sample_values appear in real data |
| `data/golden-queries-execute` | Gold | Every golden query runs without error |
| `data/golden-queries-nonempty` | Gold | Every golden query returns at least 1 row |
| `data/guardrails-valid-sql` | Gold | Every guardrail filter is valid SQL |
| `data/row-counts-nonzero` | Bronze | Referenced tables have data |

```
context lint                    # file-only rules (current behavior)
context lint --with-data        # file rules + data rules
context verify                  # shorthand for data rules only
```

## Introspection Heuristics

### table_type
- View names starting with `vw_` -> `view`
- Tables with timestamp/date columns + no obvious PK -> `event`
- Tables with single-column PK and mostly text columns -> `dimension`
- Tables with numeric columns and FK-looking columns -> `fact`
- Fallback -> `dimension`

### grain
- Single-column PK -> `"one row per {table_name} identified by {pk_column}"`
- Composite PK -> `"one row per unique combination of {col1}, {col2}"`
- No PK detected -> `"one row per record (no primary key detected)"`

### semantic_role (used by enrich)
- Column name contains `_id` or is a PK -> `identifier`
- Numeric type + name contains count/total/sum/amount/pct/rate/avg -> `metric`
- DATE/TIMESTAMP type -> `date`
- Everything else -> `dimension`

### default_aggregation (for metrics)
- Name contains `count` or `total` -> `SUM`
- Name contains `avg`, `pct`, `rate`, `median` -> `AVG`
- Name contains `max` -> `MAX`
- Name contains `min` -> `MIN`
- Fallback -> `SUM`

### sample_values
- `SELECT DISTINCT {column} FROM {table} WHERE {column} IS NOT NULL LIMIT 5`
- All values cast to strings

## File Structure

```
packages/core/src/
  adapters/
    index.ts              # AdapterFactory
    types.ts              # DataAdapter, TableInfo, ColumnInfo, QueryResult
    duckdb.ts             # DuckDBAdapter
    postgres.ts           # PostgresAdapter
  linter/rules/
    data-source-exists.ts
    data-fields-exist.ts
    data-field-types-compatible.ts
    data-sample-values-accurate.ts
    data-golden-queries-execute.ts
    data-golden-queries-nonempty.ts
    data-guardrails-valid-sql.ts
    data-row-counts-nonzero.ts
  introspect/
    index.ts              # orchestrates introspection flow
    scaffold.ts           # generates OSI + governance YAML from schema
    heuristics.ts         # type/role/aggregation inference logic
    enrich.ts             # suggests metadata for tier promotion

packages/cli/src/commands/
    introspect.ts         # context introspect command
    verify.ts             # context verify command
    enrich.ts             # context enrich command
```

## Config Type Extension

```typescript
interface ContextKitConfig {
  // ... existing fields ...
  data_sources?: Record<string, DataSourceConfig>;
}

interface DataSourceConfig {
  adapter: 'duckdb' | 'postgres';
  path?: string;          // for duckdb
  connection?: string;    // for postgres
}
```

## End-to-End Example (Thunderdome gold-agent)

```
# Step 1: Introspect — scaffolds Bronze from real schema
$ context introspect --db duckdb://../../warehouse/coffee.duckdb
  Connected to DuckDB: coffee.duckdb
  Discovered 7 tables, 7 views, 42 columns
  Scaffolded: context/models/coffee-warehouse.osi.yaml
  Scaffolded: context/governance/coffee-warehouse.governance.yaml
  Scaffolded: context/owners/default-team.owner.yaml
  Bronze tier achieved automatically

# Step 2: Verify — catch mismatches
$ context verify
  data/source-exists: 7/7 tables verified
  data/fields-exist: 42/42 fields verified
  Result: 0 errors

# Step 3: Enrich to Silver
$ context enrich --target silver --apply
  Added trust, tags, lineage, refresh cadences
  Populated sample_values from real data
  Generated glossary term
  Silver tier achieved

# Step 4: Enrich to Gold
$ context enrich --target gold --apply
  Inferred semantic_roles, aggregations, additive flags
  Generated golden queries, guardrails, business rules, hierarchy
  Gold tier achieved

# Step 5: Verify Gold metadata against data
$ context verify
  data/golden-queries-execute: 3/3 passed
  data/guardrails-valid-sql: 2/2 valid
  data/sample-values-accurate: 8/8 accurate
  Result: 0 errors, 0 warnings
```
