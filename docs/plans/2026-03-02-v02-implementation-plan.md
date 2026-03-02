# ContextKit v0.2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild ContextKit as an AI-ready metadata governance layer over the Open Semantic Interchange (OSI) v1.0 standard, with Bronze/Silver/Gold tier computation.

**Architecture:** Clean break from v0.1. ContextKit natively reads OSI v1.0 YAML files for the semantic layer (datasets, fields, metrics, relationships) and adds governance via companion YAML files (ownership, trust, security, grain, semantic roles, business rules, golden queries, guardrails, hierarchies, lineage). A tier computation engine scores each model against Bronze/Silver/Gold checklists. The compiler pipeline: Discover → Parse → Validate → Resolve → Build Graph → Lint → Compute Tiers → Emit.

**Tech Stack:** TypeScript, Zod, YAML parser, Vitest, tsup, Commander.js, EJS, MiniSearch, @modelcontextprotocol/sdk

**Design doc:** `docs/plans/2026-03-02-v02-ai-ready-metadata-design.md`

---

## Task 1: Clean Slate — Remove v0.1 Types and Schemas

Strip all v0.1 source code from `packages/core/src/`. We're doing a clean break — every file gets rewritten. Keep the project scaffolding (package.json, tsconfig, tsup.config) but gut the source.

**Files:**
- Delete: All files under `packages/core/src/types/`, `packages/core/src/schema/`, `packages/core/src/parser/`, `packages/core/src/compiler/`, `packages/core/src/graph/`, `packages/core/src/linter/`, `packages/core/src/fixer/`, `packages/core/src/config/`, `packages/core/src/__tests__/`
- Delete: `packages/core/src/index.ts`
- Delete: All files under `packages/cli/src/`
- Delete: All files under `packages/mcp/src/`
- Delete: All files under `packages/site/src/`
- Delete: All files under `fixtures/`
- Keep: All `package.json`, `tsconfig.json`, `tsup.config.ts` files

**Step 1:** Delete all source files listed above.

**Step 2:** Create placeholder `packages/core/src/index.ts`:
```typescript
// ContextKit v0.2 — AI-Ready Metadata Governance over OSI
export {};
```

**Step 3:** Verify build still runs (empty output is fine):
```bash
cd packages/core && pnpm build
```

**Step 4:** Commit:
```bash
git add -A
git commit -m "chore: clean slate for v0.2 — remove all v0.1 source"
```

---

## Task 2: Core Types — OSI + Governance Type Definitions

Define all TypeScript types for the v0.2 data model. No implementation yet — just types.

**Files:**
- Create: `packages/core/src/types/osi.ts`
- Create: `packages/core/src/types/governance.ts`
- Create: `packages/core/src/types/rules.ts`
- Create: `packages/core/src/types/lineage.ts`
- Create: `packages/core/src/types/term.ts`
- Create: `packages/core/src/types/owner.ts`
- Create: `packages/core/src/types/graph.ts`
- Create: `packages/core/src/types/diagnostics.ts`
- Create: `packages/core/src/types/config.ts`
- Create: `packages/core/src/types/tier.ts`
- Create: `packages/core/src/types/index.ts`

**Step 1:** Create `packages/core/src/types/osi.ts` — TypeScript interfaces mirroring the OSI v1.0 JSON schema:
```typescript
// Mirrors https://github.com/open-semantic-interchange/OSI core-spec/osi-schema.json

export type Dialect = 'ANSI_SQL' | 'SNOWFLAKE' | 'MDX' | 'TABLEAU' | 'DATABRICKS';
export type Vendor = 'COMMON' | 'SNOWFLAKE' | 'SALESFORCE' | 'DBT' | 'DATABRICKS';

export interface AIContext {
  instructions?: string;
  synonyms?: string[];
  examples?: string[];
}

export interface CustomExtension {
  vendor_name: Vendor;
  data: string; // JSON string
}

export interface DialectExpression {
  dialect: Dialect;
  expression: string;
}

export interface Expression {
  dialects: DialectExpression[]; // min 1
}

export interface Dimension {
  is_time?: boolean;
}

export interface OsiField {
  name: string;
  expression: Expression;
  dimension?: Dimension;
  label?: string;
  description?: string;
  ai_context?: string | AIContext;
  custom_extensions?: CustomExtension[];
}

export interface OsiDataset {
  name: string;
  source: string;
  primary_key?: string[];
  unique_keys?: string[][];
  description?: string;
  ai_context?: string | AIContext;
  fields?: OsiField[];
  custom_extensions?: CustomExtension[];
}

export interface OsiRelationship {
  name: string;
  from: string;       // many-side dataset name
  to: string;         // one-side dataset name
  from_columns: string[]; // min 1
  to_columns: string[];   // min 1
  ai_context?: string | AIContext;
  custom_extensions?: CustomExtension[];
}

export interface OsiMetric {
  name: string;
  expression: Expression;
  description?: string;
  ai_context?: string | AIContext;
  custom_extensions?: CustomExtension[];
}

export interface OsiSemanticModel {
  name: string;
  description?: string;
  ai_context?: string | AIContext;
  datasets: OsiDataset[]; // min 1
  relationships?: OsiRelationship[];
  metrics?: OsiMetric[];
  custom_extensions?: CustomExtension[];
}

export interface OsiDocument {
  version: '1.0';
  semantic_model: OsiSemanticModel[];
}
```

**Step 2:** Create `packages/core/src/types/governance.ts`:
```typescript
export type TrustStatus = 'endorsed' | 'warning' | 'deprecated';
export type SecurityClassification = 'public' | 'internal' | 'confidential' | 'secret';
export type TableType = 'fact' | 'dimension' | 'bridge' | 'snapshot' | 'event' | 'aggregate' | 'view';
export type SemanticRole = 'metric' | 'dimension' | 'identifier' | 'date';
export type DefaultAggregation = 'SUM' | 'AVG' | 'COUNT' | 'COUNT_DISTINCT' | 'MIN' | 'MAX';

export interface DatasetGovernance {
  grain: string;
  refresh?: string;
  table_type: TableType;
  security?: SecurityClassification;
}

export interface FieldGovernance {
  semantic_role: SemanticRole;
  default_aggregation?: DefaultAggregation;
  additive?: boolean;
  default_filter?: string;
  sample_values?: string[];
}

export interface GovernanceFile {
  model: string;
  owner: string;
  trust?: TrustStatus;
  security?: SecurityClassification;
  tags?: string[];
  datasets?: Record<string, DatasetGovernance>;
  fields?: Record<string, FieldGovernance>; // "dataset.field" keys
}
```

**Step 3:** Create `packages/core/src/types/rules.ts`:
```typescript
export interface GoldenQuery {
  question: string;
  sql: string;
  dialect?: string;
  tags?: string[];
}

export interface BusinessRule {
  name: string;
  definition: string;
  enforcement?: string[];
  avoid?: string[];
  tables?: string[];
  applied_always?: boolean;
}

export interface GuardrailFilter {
  name: string;
  filter: string;
  tables?: string[];
  reason: string;
}

export interface Hierarchy {
  name: string;
  levels: string[];
  dataset: string;
  field?: string;
}

export interface RulesFile {
  model: string;
  golden_queries?: GoldenQuery[];
  business_rules?: BusinessRule[];
  guardrail_filters?: GuardrailFilter[];
  hierarchies?: Hierarchy[];
}
```

**Step 4:** Create `packages/core/src/types/lineage.ts`:
```typescript
export type LineageType = 'pipeline' | 'dashboard' | 'ml_model' | 'api' | 'manual';

export interface UpstreamEntry {
  source: string;
  type: LineageType;
  pipeline?: string;
  tool?: string;
  refresh?: string;
  notes?: string;
}

export interface DownstreamEntry {
  target: string;
  type: LineageType;
  tool?: string;
  notes?: string;
}

export interface LineageFile {
  model: string;
  upstream?: UpstreamEntry[];
  downstream?: DownstreamEntry[];
}
```

**Step 5:** Create `packages/core/src/types/term.ts`:
```typescript
export interface TermFile {
  id: string;
  definition: string;
  synonyms?: string[];
  maps_to?: string[];
  owner?: string;
  tags?: string[];
}
```

**Step 6:** Create `packages/core/src/types/owner.ts`:
```typescript
export interface OwnerFile {
  id: string;
  display_name: string;
  email?: string;
  team?: string;
  description?: string;
}
```

**Step 7:** Create `packages/core/src/types/diagnostics.ts`:
```typescript
export type Severity = 'error' | 'warning';

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface TextEdit {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  newText: string;
}

export interface Fix {
  description: string;
  edits: TextEdit[];
}

export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  location: SourceLocation;
  fixable: boolean;
  fix?: Fix;
}
```

**Step 8:** Create `packages/core/src/types/tier.ts`:
```typescript
export type MetadataTier = 'none' | 'bronze' | 'silver' | 'gold';

export interface TierCheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface TierScore {
  model: string;
  tier: MetadataTier;
  bronze: { passed: boolean; checks: TierCheckResult[] };
  silver: { passed: boolean; checks: TierCheckResult[] };
  gold: { passed: boolean; checks: TierCheckResult[] };
}
```

**Step 9:** Create `packages/core/src/types/graph.ts`:
```typescript
import type { OsiSemanticModel } from './osi.js';
import type { GovernanceFile } from './governance.js';
import type { RulesFile } from './rules.js';
import type { LineageFile } from './lineage.js';
import type { TermFile } from './term.js';
import type { OwnerFile } from './owner.js';
import type { TierScore } from './tier.js';

export interface ContextGraph {
  models: Map<string, OsiSemanticModel>;
  governance: Map<string, GovernanceFile>;
  rules: Map<string, RulesFile>;
  lineage: Map<string, LineageFile>;
  terms: Map<string, TermFile>;
  owners: Map<string, OwnerFile>;
  tiers: Map<string, TierScore>;
  indexes: {
    byOwner: Map<string, string[]>;
    byTag: Map<string, string[]>;
    byTrust: Map<string, string[]>;
    modelToGovernance: Map<string, string>;
    modelToRules: Map<string, string>;
    modelToLineage: Map<string, string>;
  };
}
```

**Step 10:** Create `packages/core/src/types/config.ts`:
```typescript
import type { MetadataTier } from './tier.js';
import type { Severity } from './diagnostics.js';

export interface LintConfig {
  severity_overrides?: Record<string, Severity | 'off'>;
}

export interface SiteConfig {
  title?: string;
  base_path?: string;
}

export interface McpConfig {
  transport?: 'stdio' | 'http';
  port?: number;
}

export interface ContextKitConfig {
  context_dir: string;
  output_dir: string;
  minimum_tier?: MetadataTier;
  lint?: LintConfig;
  site?: SiteConfig;
  mcp?: McpConfig;
}
```

**Step 11:** Create `packages/core/src/types/index.ts` re-exporting everything:
```typescript
export * from './osi.js';
export * from './governance.js';
export * from './rules.js';
export * from './lineage.js';
export * from './term.js';
export * from './owner.js';
export * from './graph.js';
export * from './diagnostics.js';
export * from './config.js';
export * from './tier.js';
```

**Step 12:** Update `packages/core/src/index.ts`:
```typescript
export * from './types/index.js';
```

**Step 13:** Verify build:
```bash
cd packages/core && pnpm build
```

**Step 14:** Commit:
```bash
git add -A
git commit -m "feat(core): add v0.2 type definitions — OSI, governance, rules, lineage, tiers"
```

---

## Task 3: Zod Schemas — Validation for All File Types

Create Zod schemas for parsing and validating every YAML file type. The OSI schema validates against the bundled OSI JSON schema; all others use Zod.

**Files:**
- Create: `packages/core/src/schema/osi.ts`
- Create: `packages/core/src/schema/governance.ts`
- Create: `packages/core/src/schema/rules.ts`
- Create: `packages/core/src/schema/lineage.ts`
- Create: `packages/core/src/schema/term.ts`
- Create: `packages/core/src/schema/owner.ts`
- Create: `packages/core/src/schema/config.ts`
- Create: `packages/core/src/schema/index.ts`
- Create: `packages/core/src/schema/__tests__/schemas.test.ts`

**Step 1:** Write tests in `packages/core/src/schema/__tests__/schemas.test.ts` that validate each schema accepts valid input and rejects invalid input. Test at least:
- OSI document schema: valid minimal model, missing required fields, invalid dialect
- Governance schema: valid full governance, missing model ref, invalid trust status, invalid semantic_role, field key format ("dataset.field")
- Rules schema: valid golden queries, valid business rules, valid guardrails, valid hierarchies
- Lineage schema: valid upstream/downstream, invalid type
- Term schema: valid term, missing definition
- Owner schema: valid owner, missing display_name
- Config schema: valid config, defaults applied

Target: ~30 tests.

**Step 2:** Run tests to verify they fail:
```bash
cd packages/core && pnpm vitest run src/schema/__tests__/schemas.test.ts
```

**Step 3:** Implement all Zod schemas. Key design decisions:
- `osiDocumentSchema` validates the full OSI v1.0 structure using Zod (mirrors the JSON schema)
- `governanceFileSchema` validates governance files; `fields` keys must match `dataset.field` pattern
- `rulesFileSchema` validates rules; all arrays are optional
- `lineageFileSchema`, `termFileSchema`, `ownerFileSchema` are straightforward
- `configSchema` has defaults: `context_dir: "context"`, `output_dir: "dist"`

**Step 4:** Run tests to verify they pass:
```bash
cd packages/core && pnpm vitest run src/schema/__tests__/schemas.test.ts
```

**Step 5:** Commit:
```bash
git add -A
git commit -m "feat(core): add Zod validation schemas for all file types"
```

---

## Task 4: Parser — File Discovery and YAML Parsing

Discover context files by extension pattern, parse YAML, and return typed objects.

**Files:**
- Create: `packages/core/src/parser/discover.ts`
- Create: `packages/core/src/parser/parse.ts`
- Create: `packages/core/src/parser/index.ts`
- Create: `packages/core/src/parser/__tests__/parser.test.ts`
- Create: `fixtures/valid/models/retail-sales.osi.yaml`
- Create: `fixtures/valid/governance/retail-sales.governance.yaml`
- Create: `fixtures/valid/rules/retail-sales.rules.yaml`
- Create: `fixtures/valid/lineage/retail-sales.lineage.yaml`
- Create: `fixtures/valid/glossary/revenue.term.yaml`
- Create: `fixtures/valid/owners/analytics-team.owner.yaml`
- Create: `fixtures/valid/contextkit.config.yaml`
- Create: `fixtures/invalid/models/bad-model.osi.yaml` (invalid OSI)
- Create: `fixtures/invalid/governance/bad-governance.governance.yaml` (missing model ref)

**Step 1:** Create all fixture files. The valid fixtures should form a complete, valid project. The invalid fixtures should have specific, testable problems.

Valid OSI model (`fixtures/valid/models/retail-sales.osi.yaml`):
```yaml
version: "1.0"

semantic_model:
  - name: retail-sales
    description: Retail sales analytics model
    ai_context:
      instructions: "Use for sales revenue and customer analysis"
      synonyms: ["sales model", "revenue model"]

    datasets:
      - name: transactions
        source: warehouse.public.transactions
        primary_key: [txn_id]
        description: "Sales transactions fact table"
        fields:
          - name: txn_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: txn_id
            description: Unique transaction identifier
          - name: customer_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: customer_id
            description: Foreign key to customers
            dimension:
              is_time: false
          - name: amount
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: amount
            description: Transaction amount in USD
            ai_context:
              synonyms: ["revenue", "sales amount"]
          - name: txn_date
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: txn_date
            description: Transaction date
            dimension:
              is_time: true

      - name: customers
        source: warehouse.public.customers
        primary_key: [customer_id]
        description: "Customer dimension table"
        fields:
          - name: customer_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: customer_id
            description: Unique customer identifier
          - name: region
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: region
            description: Customer region
            dimension:
              is_time: false
            ai_context:
              synonyms: ["geography", "area"]
          - name: segment
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: segment
            description: Customer segment
            dimension:
              is_time: false

    relationships:
      - name: txn_to_customer
        from: transactions
        to: customers
        from_columns: [customer_id]
        to_columns: [customer_id]

    metrics:
      - name: total_revenue
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: SUM(transactions.amount)
        description: Total revenue across all transactions
        ai_context:
          synonyms: ["total sales", "gross revenue"]
      - name: avg_order_value
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: AVG(transactions.amount)
        description: Average transaction amount
      - name: customer_count
        expression:
          dialects:
            - dialect: ANSI_SQL
              expression: COUNT(DISTINCT transactions.customer_id)
        description: Unique customer count
```

Valid governance (`fixtures/valid/governance/retail-sales.governance.yaml`):
```yaml
model: retail-sales
owner: analytics-team
trust: endorsed
security: internal
tags: [finance, revenue, kpi]

datasets:
  transactions:
    grain: "One row per transaction line item"
    refresh: daily
    table_type: fact
    security: confidential
  customers:
    grain: "One row per registered customer"
    refresh: hourly
    table_type: dimension

fields:
  transactions.amount:
    semantic_role: metric
    default_aggregation: SUM
    additive: true
    default_filter: "amount > 0"
  transactions.txn_id:
    semantic_role: identifier
  transactions.customer_id:
    semantic_role: identifier
    default_filter: "customer_id IS NOT NULL"
  transactions.txn_date:
    semantic_role: date
  customers.customer_id:
    semantic_role: identifier
  customers.region:
    semantic_role: dimension
    sample_values: [NA, EMEA, APAC, LATAM]
  customers.segment:
    semantic_role: dimension
    sample_values: [Enterprise, SMB, Consumer]
```

Valid rules (`fixtures/valid/rules/retail-sales.rules.yaml`):
```yaml
model: retail-sales

golden_queries:
  - question: "What is total revenue by region?"
    sql: |
      SELECT c.region, SUM(t.amount) AS total_revenue
      FROM transactions t
      JOIN customers c ON t.customer_id = c.customer_id
      GROUP BY c.region
      ORDER BY total_revenue DESC
    dialect: ANSI_SQL
    tags: [revenue, regional]
  - question: "What is the average order value by customer segment?"
    sql: |
      SELECT c.segment, AVG(t.amount) AS avg_order_value
      FROM transactions t
      JOIN customers c ON t.customer_id = c.customer_id
      GROUP BY c.segment
    dialect: ANSI_SQL
  - question: "How many unique customers purchased in the last 30 days?"
    sql: |
      SELECT COUNT(DISTINCT customer_id)
      FROM transactions
      WHERE txn_date >= CURRENT_DATE - INTERVAL '30 days'
    dialect: ANSI_SQL

business_rules:
  - name: count-distinct-customers
    definition: "Always use COUNT(DISTINCT customer_id) when counting customers"
    enforcement:
      - "Use COUNT(DISTINCT customer_id) for customer counts"
    avoid:
      - "Never use COUNT(*) to count customers"
    tables: [transactions]
    applied_always: true

guardrail_filters:
  - name: positive-amounts-only
    filter: "amount > 0"
    tables: [transactions]
    reason: "Exclude refunds and adjustments from revenue calculations"

hierarchies:
  - name: geography
    levels: [region, segment]
    dataset: customers
```

Valid lineage (`fixtures/valid/lineage/retail-sales.lineage.yaml`):
```yaml
model: retail-sales

upstream:
  - source: erp.orders
    type: pipeline
    pipeline: dbt-daily
    refresh: daily
    notes: "Raw orders transformed into transactions"

downstream:
  - target: executive-dashboard
    type: dashboard
    tool: tableau
```

Valid term (`fixtures/valid/glossary/revenue.term.yaml`):
```yaml
id: revenue
definition: "Total value of completed transactions before refunds"
synonyms: [sales, gross revenue, top-line]
owner: analytics-team
tags: [finance, kpi]
```

Valid owner (`fixtures/valid/owners/analytics-team.owner.yaml`):
```yaml
id: analytics-team
display_name: Analytics Team
email: analytics@company.com
team: data-platform
description: "Responsible for analytics infrastructure"
```

Valid config (`fixtures/valid/contextkit.config.yaml`):
```yaml
context_dir: .
output_dir: dist
minimum_tier: bronze
```

**Step 2:** Write tests covering:
- `discoverFiles(contextDir)` finds all files by extension pattern
- `parseFile(path)` returns typed `{ kind, data, source }` for each file type
- Invalid YAML produces diagnostics
- File type is inferred from extension (`.osi.yaml` → model, `.governance.yaml` → governance, etc.)

Target: ~15 tests.

**Step 3:** Implement `discover.ts`:
```typescript
export type FileKind = 'model' | 'governance' | 'rules' | 'lineage' | 'term' | 'owner';

export interface DiscoveredFile {
  path: string;
  kind: FileKind;
}

export async function discoverFiles(contextDir: string): Promise<DiscoveredFile[]>
```

Glob patterns:
- `**/*.osi.yaml` → model
- `**/*.governance.yaml` → governance
- `**/*.rules.yaml` → rules
- `**/*.lineage.yaml` → lineage
- `**/*.term.yaml` → term
- `**/*.owner.yaml` → owner

**Step 4:** Implement `parse.ts`:
```typescript
export interface ParsedFile {
  kind: FileKind;
  data: unknown; // raw parsed YAML
  source: { file: string; line: number; column: number };
}

export async function parseFile(filePath: string, kind: FileKind): Promise<ParsedFile>
```

**Step 5:** Run tests, verify pass.

**Step 6:** Commit:
```bash
git add -A
git commit -m "feat(core): add parser with file discovery and YAML parsing"
```

---

## Task 5: Compiler — Validate, Resolve, Build Graph

The main compiler pipeline that takes discovered files and produces a ContextGraph.

**Files:**
- Create: `packages/core/src/compiler/validate.ts`
- Create: `packages/core/src/compiler/resolve.ts`
- Create: `packages/core/src/compiler/graph.ts`
- Create: `packages/core/src/compiler/pipeline.ts`
- Create: `packages/core/src/compiler/index.ts`
- Create: `packages/core/src/compiler/__tests__/compiler.test.ts`

**Step 1:** Write tests covering:
- `validate(parsedFile)` returns typed node + diagnostics for each file kind
- `validate` rejects invalid data with specific error messages
- `resolve(graph)` detects: missing model references, missing owner references, invalid dataset/field references in governance, invalid table references in rules
- `buildGraph(validatedNodes)` populates all maps and indexes
- `compile(contextDir)` runs the full pipeline end-to-end using the valid fixtures

Target: ~25 tests.

**Step 2:** Implement `validate.ts`:
```typescript
export interface ValidateResult {
  kind: FileKind;
  data?: OsiSemanticModel | GovernanceFile | RulesFile | LineageFile | TermFile | OwnerFile;
  diagnostics: Diagnostic[];
}

export function validate(parsed: ParsedFile): ValidateResult
```

For OSI files, validate against the Zod OSI schema. For other file types, validate against their respective Zod schemas.

**Step 3:** Implement `resolve.ts` — cross-file reference validation:
```typescript
export function resolveReferences(graph: ContextGraph): Diagnostic[]
```

Checks:
- Every `governance.model` matches an entry in `graph.models`
- Every `governance.owner` matches an entry in `graph.owners`
- Every key in `governance.datasets` matches a dataset name in the referenced OSI model
- Every key in `governance.fields` (format: `dataset.field`) references a valid dataset + field combination
- Every `rules.model` matches an entry in `graph.models`
- Every `rules.business_rules[].tables` entry matches a dataset name
- Every `rules.guardrail_filters[].tables` entry matches a dataset name
- Every `rules.hierarchies[].dataset` matches a dataset name
- Every `lineage.model` matches an entry in `graph.models`
- Every `term.owner` matches an entry in `graph.owners`
- Every `term.maps_to` entry matches another term ID

**Step 4:** Implement `graph.ts`:
```typescript
export function buildGraph(nodes: ValidateResult[]): ContextGraph
export function createEmptyGraph(): ContextGraph
```

Builds all maps (`models`, `governance`, `rules`, `lineage`, `terms`, `owners`) and populates indexes (`byOwner`, `byTag`, `byTrust`, `modelToGovernance`, `modelToRules`, `modelToLineage`).

**Step 5:** Implement `pipeline.ts`:
```typescript
export interface CompileResult {
  graph: ContextGraph;
  diagnostics: Diagnostic[];
}

export async function compile(options: { contextDir: string; config?: ContextKitConfig }): Promise<CompileResult>
```

Pipeline: discover → parse → validate → build graph → resolve references.

**Step 6:** Run tests, verify pass.

**Step 7:** Commit:
```bash
git add -A
git commit -m "feat(core): add compiler pipeline — validate, resolve, build graph"
```

---

## Task 6: Lint Engine + Bronze Rules

Recreate the lint engine with the v0.2 rule interface, then implement Bronze-tier rules.

**Files:**
- Create: `packages/core/src/linter/rule.ts`
- Create: `packages/core/src/linter/engine.ts`
- Create: `packages/core/src/linter/rules/naming-id-kebab-case.ts`
- Create: `packages/core/src/linter/rules/descriptions-required.ts`
- Create: `packages/core/src/linter/rules/ownership-required.ts`
- Create: `packages/core/src/linter/rules/references-resolvable.ts`
- Create: `packages/core/src/linter/rules/glossary-no-duplicate-terms.ts`
- Create: `packages/core/src/linter/rules/no-secrets.ts`
- Create: `packages/core/src/linter/rules/osi-valid-schema.ts`
- Create: `packages/core/src/linter/rules/governance-model-exists.ts`
- Create: `packages/core/src/linter/rules/governance-datasets-exist.ts`
- Create: `packages/core/src/linter/rules/governance-fields-exist.ts`
- Create: `packages/core/src/linter/rules/governance-grain-required.ts`
- Create: `packages/core/src/linter/rules/governance-security-required.ts`
- Create: `packages/core/src/linter/rules/index.ts`
- Create: `packages/core/src/linter/index.ts`
- Create: `packages/core/src/linter/__tests__/engine.test.ts`
- Create: `packages/core/src/linter/__tests__/bronze-rules.test.ts`

**Step 1:** Write tests for the lint engine (register, run, severity overrides, off) and for each Bronze-relevant rule. Use fixture data or inline ContextGraph construction.

Target: ~35 tests.

**Step 2:** Implement `rule.ts` (same interface as v0.1):
```typescript
export interface LintRule {
  id: string;
  defaultSeverity: Severity;
  description: string;
  fixable: boolean;
  run(graph: ContextGraph): Diagnostic[];
}
```

**Step 3:** Implement `engine.ts` (LintEngine class).

**Step 4:** Implement all 12 rules listed above:
- Rules 1-6: adapted from v0.1 (references now check new graph structure)
- Rules 7-12: new Bronze-tier rules

**Step 5:** Run tests, verify pass.

**Step 6:** Commit:
```bash
git add -A
git commit -m "feat(core): add lint engine and Bronze-tier rules (12 rules)"
```

---

## Task 7: Silver + Gold Lint Rules

Add the remaining lint rules for Silver and Gold tier requirements.

**Files:**
- Create: `packages/core/src/linter/rules/governance-trust-required.ts`
- Create: `packages/core/src/linter/rules/governance-refresh-required.ts`
- Create: `packages/core/src/linter/rules/lineage-upstream-required.ts`
- Create: `packages/core/src/linter/rules/governance-semantic-role-required.ts`
- Create: `packages/core/src/linter/rules/governance-aggregation-required.ts`
- Create: `packages/core/src/linter/rules/governance-additive-required.ts`
- Create: `packages/core/src/linter/rules/rules-golden-queries-minimum.ts`
- Create: `packages/core/src/linter/rules/rules-business-rules-exist.ts`
- Create: `packages/core/src/linter/rules/rules-guardrails-exist.ts`
- Create: `packages/core/src/linter/rules/rules-hierarchies-exist.ts`
- Create: `packages/core/src/linter/rules/tier-bronze.ts`
- Create: `packages/core/src/linter/rules/tier-silver.ts`
- Create: `packages/core/src/linter/rules/tier-gold.ts`
- Modify: `packages/core/src/linter/rules/index.ts` (add new rules to ALL_RULES)
- Create: `packages/core/src/linter/__tests__/silver-gold-rules.test.ts`

**Step 1:** Write tests for each new rule. Test with graphs that pass and fail each check.

Target: ~30 tests.

**Step 2:** Implement all 13 rules. The composite tier rules (`tier-bronze`, `tier-silver`, `tier-gold`) aggregate the individual checks and report the overall tier status.

**Step 3:** Run tests, verify pass.

**Step 4:** Commit:
```bash
git add -A
git commit -m "feat(core): add Silver and Gold lint rules (25 total rules)"
```

---

## Task 8: Tier Computation Engine

Implement the tier scoring engine that evaluates a model against Bronze/Silver/Gold checklists.

**Files:**
- Create: `packages/core/src/tier/compute.ts`
- Create: `packages/core/src/tier/checks.ts`
- Create: `packages/core/src/tier/index.ts`
- Create: `packages/core/src/tier/__tests__/tier.test.ts`

**Step 1:** Write tests:
- A fully-complete model scores Gold
- A model missing semantic_role on a field scores Silver (not Gold)
- A model missing trust status scores Bronze (not Silver)
- A model missing descriptions scores None (not Bronze)
- `computeTier(modelName, graph)` returns `TierScore` with detailed check results
- `computeAllTiers(graph)` populates `graph.tiers`

Target: ~12 tests.

**Step 2:** Implement `checks.ts` — individual check functions:
```typescript
export function checkBronze(modelName: string, graph: ContextGraph): TierCheckResult[]
export function checkSilver(modelName: string, graph: ContextGraph): TierCheckResult[]
export function checkGold(modelName: string, graph: ContextGraph): TierCheckResult[]
```

Bronze checks (7):
1. Model has name and description
2. All datasets have descriptions
3. All fields have descriptions
4. Owner assigned and resolvable
5. Security classification set
6. All datasets have grain statements
7. All datasets have table_type

Silver checks (6):
1. Trust status is set
2. At least 2 tags
3. Glossary term linked (tags overlap or owner overlap)
4. Upstream lineage exists
5. All datasets have refresh cadence
6. At least 2 fields have sample_values

Gold checks (10):
1. Every field has semantic_role
2. Every metric field has default_aggregation
3. Every metric field has additive flag
4. At least 1 guardrail_filter exists
5. At least 3 golden_queries exist
6. At least 1 business_rule exists
7. At least 1 hierarchy exists
8. At least 1 field has default_filter
9. Trust is endorsed
10. Security controls adequate

**Step 3:** Implement `compute.ts`:
```typescript
export function computeTier(modelName: string, graph: ContextGraph): TierScore
export function computeAllTiers(graph: ContextGraph): void // populates graph.tiers
```

**Step 4:** Integrate into the compiler pipeline — call `computeAllTiers` after lint.

**Step 5:** Run tests, verify pass.

**Step 6:** Commit:
```bash
git add -A
git commit -m "feat(core): add tier computation engine (Bronze/Silver/Gold)"
```

---

## Task 9: Manifest Emit + Config Loader

Emit the compiled manifest to JSON and load project configuration.

**Files:**
- Create: `packages/core/src/compiler/emit.ts`
- Create: `packages/core/src/config/loader.ts`
- Create: `packages/core/src/config/defaults.ts`
- Create: `packages/core/src/config/index.ts`
- Create: `packages/core/src/compiler/__tests__/emit.test.ts`
- Create: `packages/core/src/config/__tests__/config.test.ts`

**Step 1:** Write tests:
- `emitManifest(graph, config)` produces JSON with models, governance, rules, lineage, terms, owners, tiers
- `loadConfig(rootDir)` reads `contextkit.config.yaml` and applies defaults
- `loadConfig` returns defaults when no config file exists
- Config validates via Zod schema

Target: ~10 tests.

**Step 2:** Implement `emit.ts`:
```typescript
export interface Manifest {
  version: string;
  generatedAt: string;
  models: Record<string, any>;
  governance: Record<string, any>;
  rules: Record<string, any>;
  lineage: Record<string, any>;
  terms: Record<string, any>;
  owners: Record<string, any>;
  tiers: Record<string, TierScore>;
}

export function emitManifest(graph: ContextGraph, config: ContextKitConfig): Manifest
```

**Step 3:** Implement config loader.

**Step 4:** Update `packages/core/src/index.ts` to export everything.

**Step 5:** Run ALL core tests:
```bash
cd packages/core && pnpm vitest run
```

**Step 6:** Commit:
```bash
git add -A
git commit -m "feat(core): add manifest emit and config loader"
```

---

## Task 10: Fixer

Recreate the fixer module for auto-fixing lint issues.

**Files:**
- Create: `packages/core/src/fixer/apply.ts`
- Create: `packages/core/src/fixer/index.ts`
- Create: `packages/core/src/fixer/__tests__/fixer.test.ts`

**Step 1:** Write tests for `applyFixes(diagnostics)` — same behavior as v0.1 (group edits by file, apply in reverse order, return new content).

Target: ~5 tests.

**Step 2:** Implement `apply.ts` (port from v0.1 with minor adjustments).

**Step 3:** Run tests, verify pass.

**Step 4:** Commit:
```bash
git add -A
git commit -m "feat(core): add fixer module for auto-fix lint issues"
```

---

## Task 11: CLI — All Commands

Rebuild the CLI with all commands for v0.2.

**Files:**
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/lint.ts`
- Create: `packages/cli/src/commands/build.ts`
- Create: `packages/cli/src/commands/tier.ts`
- Create: `packages/cli/src/commands/explain.ts`
- Create: `packages/cli/src/commands/fix.ts`
- Create: `packages/cli/src/commands/dev.ts`
- Create: `packages/cli/src/commands/init.ts`
- Create: `packages/cli/src/commands/site.ts`
- Create: `packages/cli/src/commands/serve.ts`
- Create: `packages/cli/src/commands/validate-osi.ts`
- Create: `packages/cli/src/formatters/pretty.ts`
- Create: `packages/cli/src/formatters/json.ts`

**Step 1:** Implement all CLI commands using Commander.js. Key changes from v0.1:
- New `tier` command: `npx context tier [model-name]` — shows tier scorecard
- New `validate-osi` command: `npx context validate-osi <file>` — validates an OSI file
- Updated `explain` command: looks up models, terms, owners
- Updated `build`: emits manifest with tier scores
- Updated `lint`: runs all 25 rules, respects `minimum_tier` config
- Updated `init`: scaffolds v0.2 project structure

**Step 2:** Build and test CLI manually:
```bash
cd packages/cli && pnpm build
cd /path/to/fixtures/valid && node /path/to/packages/cli/dist/index.js lint
```

**Step 3:** Commit:
```bash
git add -A
git commit -m "feat(cli): rebuild CLI with tier, validate-osi, and all v0.2 commands"
```

---

## Task 12: MCP Server

Rebuild the MCP server with v0.2 resources and tools.

**Files:**
- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/resources/manifest.ts`
- Create: `packages/mcp/src/resources/model.ts`
- Create: `packages/mcp/src/resources/glossary.ts`
- Create: `packages/mcp/src/resources/tier.ts`
- Create: `packages/mcp/src/tools/search.ts`
- Create: `packages/mcp/src/tools/explain.ts`
- Create: `packages/mcp/src/tools/validate.ts`
- Create: `packages/mcp/src/tools/tier.ts`
- Create: `packages/mcp/src/tools/golden-query.ts`
- Create: `packages/mcp/src/tools/guardrails.ts`
- Create: `packages/mcp/src/index.ts`
- Create: `packages/mcp/src/__tests__/server.test.ts`

**Step 1:** Write tests:
- Server creates successfully from manifest
- Each resource returns correct data (manifest, model with merged governance, glossary, tier)
- `context_search` finds models, datasets, fields, terms by keyword
- `context_explain` returns merged OSI + governance + rules for a model
- `context_tier` returns tier scorecard
- `context_golden_query` finds relevant golden queries
- `context_guardrails` returns applicable guardrails for given tables

Target: ~20 tests.

**Step 2:** Implement all resources and tools.

Resources:
- `context://manifest` — full manifest JSON
- `context://model/{name}` — OSI model merged with governance + rules + lineage + tier
- `context://glossary` — all terms
- `context://tier/{name}` — tier scorecard for a model

Tools:
- `context_search` — keyword search across all node types
- `context_explain` — deep lookup with related governance
- `context_validate` — run linter
- `context_tier` — compute tier for a model
- `context_golden_query` — find golden queries matching a question
- `context_guardrails` — return guardrail filters for tables

**Step 3:** Run tests, verify pass.

**Step 4:** Commit:
```bash
git add -A
git commit -m "feat(mcp): rebuild MCP server with tier, golden queries, guardrails"
```

---

## Task 13: Site Generator

Rebuild the site generator with tier badges, schema browser, and governance pages.

**Files:**
- Create: `packages/site/src/generator.ts`
- Create: `packages/site/src/templates.ts`
- Create: `packages/site/src/search/build-index.ts`
- Create: `packages/site/src/index.ts`
- Create: `packages/site/src/__tests__/generator.test.ts`

**Step 1:** Write tests:
- `generateSite` produces expected file structure
- Model pages include tier badge
- Schema browser page lists datasets → fields
- Golden query gallery page exists
- Search index includes models, datasets, terms

Target: ~10 tests.

**Step 2:** Implement templates (embedded EJS strings):
- `index.html` — home with model list and tier badges
- `models/{name}.html` — model page with tier badge, datasets, fields, relationships, metrics
- `models/{name}/schema.html` — schema browser with semantic roles and aggregations
- `models/{name}/rules.html` — golden queries, business rules, guardrails
- `glossary.html` — all terms
- `owners/{id}.html` — owner with governed models
- `search.html` — search UI
- Tailwind CDN for styling

**Step 3:** Run tests, verify pass.

**Step 4:** Commit:
```bash
git add -A
git commit -m "feat(site): rebuild site generator with tier badges and schema browser"
```

---

## Task 14: Scaffolder Update

Update `create-contextkit` to scaffold v0.2 project structure.

**Files:**
- Modify: `create-contextkit/src/index.ts`
- Replace: `create-contextkit/templates/minimal/` — new v0.2 templates

**Step 1:** Create new template files:
- `templates/minimal/models/example-model.osi.yaml` — minimal valid OSI model
- `templates/minimal/governance/example-model.governance.yaml` — minimal governance
- `templates/minimal/rules/example-model.rules.yaml` — one golden query, one business rule
- `templates/minimal/glossary/example-term.term.yaml` — example term
- `templates/minimal/owners/example-team.owner.yaml` — example owner
- `templates/minimal/contextkit.config.yaml.template` — config with context_dir

**Step 2:** Update scaffolder to copy new templates.

**Step 3:** Build and test:
```bash
cd create-contextkit && pnpm build
node dist/index.js /tmp/test-scaffold
ls -R /tmp/test-scaffold
```

**Step 4:** Commit:
```bash
git add -A
git commit -m "feat(scaffolder): update create-contextkit for v0.2 format"
```

---

## Task 15: Integration Tests

End-to-end tests using the fixtures directory.

**Files:**
- Create: `packages/core/src/__tests__/integration.test.ts`

**Step 1:** Write tests:
- Full compile of valid fixtures → no errors, graph is complete
- Tier computation on valid fixtures → Gold tier
- Lint on valid fixtures → 0 errors
- Full compile of invalid fixtures → specific expected diagnostics
- Manifest emit → valid JSON with all expected sections
- Build + lint + tier as a single CLI-like flow

Target: ~8 tests.

**Step 2:** Run ALL tests across ALL packages:
```bash
pnpm test
```

**Step 3:** Commit:
```bash
git add -A
git commit -m "test: add v0.2 integration tests"
```

---

## Task 16: Build Verification + Final Polish

Verify everything builds, all tests pass, CLI works end-to-end.

**Step 1:** Full build:
```bash
pnpm build
```
All 5 packages must build successfully.

**Step 2:** Full test:
```bash
pnpm test
```
All tests pass.

**Step 3:** CLI smoke test from fixtures:
```bash
cd fixtures/valid
node ../../packages/cli/dist/index.js lint
node ../../packages/cli/dist/index.js build
node ../../packages/cli/dist/index.js tier
node ../../packages/cli/dist/index.js explain retail-sales
node ../../packages/cli/dist/index.js site build
```

**Step 4:** Update root `README.md` for v0.2 (OSI, tiers, new commands).

**Step 5:** Commit:
```bash
git add -A
git commit -m "chore: v0.2 build verification and README update"
```

---

## Publish Order (after all tasks)

```bash
# Bump all versions to 0.2.0
# Replace workspace:^ with ^0.2.0 in cli/site/mcp package.json
pnpm build
cd packages/core && npm publish --access public
cd ../site && npm publish --access public
cd ../mcp && npm publish --access public
cd ../cli && npm publish --access public
cd ../../create-contextkit && npm publish --access public
# Restore workspace:^ and commit
```

---

## Test Count Target

| Package | Tests |
|---------|-------|
| core: schemas | ~30 |
| core: parser | ~15 |
| core: compiler | ~25 |
| core: lint engine + bronze | ~35 |
| core: silver + gold rules | ~30 |
| core: tier computation | ~12 |
| core: emit + config | ~10 |
| core: fixer | ~5 |
| core: integration | ~8 |
| mcp: server | ~20 |
| site: generator | ~10 |
| **Total** | **~200** |
