# ContextKit v0.2 Design: AI-Ready Metadata Governance over OSI

## Summary

ContextKit v0.2 is a clean break from v0.1. It becomes a governance and AI-readiness layer built on top of the [Open Semantic Interchange (OSI) v1.0](https://opensemanticinterchange.org/) specification — the vendor-neutral semantic model standard backed by Snowflake, dbt Labs, Salesforce, Alation, and others.

**OSI defines the shared language** (datasets, fields, metrics, relationships).
**ContextKit adds governance** (ownership, trust, security, metadata quality tiers, business rules, golden queries, guardrails, hierarchies, lineage) and **computes AI-readiness** via Bronze/Silver/Gold tier scoring.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Semantic layer format | OSI v1.0 YAML (native) | Industry standard, interoperable with Snowflake/dbt/Alation |
| Governance format | Companion YAML files | OSI files stay pure; governance is additive |
| Metadata tiers | Computed by linter | No manual declaration — tier IS the lint result |
| v0.1 compatibility | Clean break | No real users yet; not worth the complexity |
| Scope | Full governance layer | Tiers + business rules + golden queries + guardrails + hierarchies + lineage |

---

## 1. File Structure

```
context/
  models/                              # OSI v1.0 semantic models
    <model-name>.osi.yaml              # Standard OSI — no ContextKit fields
  governance/                          # Governance metadata
    <model-name>.governance.yaml       # Ownership, trust, security, grain, field semantics
  rules/                               # Business rules & golden queries
    <model-name>.rules.yaml            # Rules, guardrails, golden queries, hierarchies
  lineage/                             # Lineage declarations
    <model-name>.lineage.yaml          # Upstream/downstream sources
  glossary/                            # Business glossary
    <term-id>.term.yaml                # Term definitions with synonyms
  owners/                              # Ownership registry
    <owner-id>.owner.yaml              # Team/person definitions
contextkit.config.yaml                 # Project configuration
```

File discovery uses these glob patterns:
- `**/*.osi.yaml` — OSI semantic models
- `**/*.governance.yaml` — governance companions
- `**/*.rules.yaml` — business rules
- `**/*.lineage.yaml` — lineage declarations
- `**/*.term.yaml` — glossary terms
- `**/*.owner.yaml` — ownership registry

---

## 2. YAML Formats

### 2.1 OSI Semantic Model (`*.osi.yaml`)

Standard OSI v1.0. ContextKit parses and validates against the OSI JSON schema but never modifies or extends these files. This ensures any OSI-compatible tool (Snowflake, dbt, Tableau) can consume them.

```yaml
version: "1.0"

semantic_model:
  - name: retail-sales
    description: Retail sales analytics model
    ai_context:
      instructions: "Use for sales revenue analysis..."
      synonyms: ["sales model", "revenue model"]

    datasets:
      - name: transactions
        source: warehouse.public.transactions
        primary_key: [txn_id]
        fields:
          - name: txn_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: txn_id
            description: Unique transaction identifier
          - name: amount
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: amount
            description: Transaction amount in USD
            ai_context:
              synonyms: ["revenue", "sales amount"]
          # ...more fields

      - name: customers
        source: warehouse.public.customers
        primary_key: [customer_id]
        fields:
          - name: customer_id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: customer_id
            description: Unique customer identifier
          # ...more fields

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
```

### 2.2 Governance File (`*.governance.yaml`)

References an OSI model by name and layers on governance metadata.

```yaml
model: retail-sales              # must match an OSI model name

# Model-level governance
owner: analytics-team            # ref to owner registry
trust: endorsed                  # endorsed | warning | deprecated
security: internal               # public | internal | confidential | secret
tags: [finance, revenue, kpi]

# Dataset-level governance
datasets:
  transactions:
    grain: "One row per transaction line item"
    refresh: daily
    table_type: fact             # fact | dimension | bridge | snapshot | event | aggregate | view
    security: confidential       # overrides model-level if set
  customers:
    grain: "One row per registered customer"
    refresh: hourly
    table_type: dimension

# Field-level governance (dataset.field notation)
fields:
  transactions.amount:
    semantic_role: metric        # metric | dimension | identifier | date
    default_aggregation: SUM     # SUM | AVG | COUNT | COUNT_DISTINCT | MIN | MAX
    additive: true
    default_filter: "amount > 0"
  transactions.txn_id:
    semantic_role: identifier
  transactions.txn_date:
    semantic_role: date
  customers.customer_id:
    semantic_role: identifier
    default_filter: "customer_id IS NOT NULL"
  customers.region:
    semantic_role: dimension
    sample_values: [NA, EMEA, APAC, LATAM]
```

### 2.3 Rules File (`*.rules.yaml`)

Business rules, golden queries, guardrail filters, and hierarchies for a model.

```yaml
model: retail-sales

golden_queries:
  - question: "What is total revenue by region for the last 30 days?"
    sql: |
      SELECT c.region, SUM(t.amount) AS total_revenue
      FROM transactions t
      JOIN customers c ON t.customer_id = c.customer_id
      WHERE t.txn_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY c.region
      ORDER BY total_revenue DESC
    dialect: ANSI_SQL
    tags: [revenue, regional]

business_rules:
  - name: count-distinct-customers
    definition: "Always use COUNT(DISTINCT customer_id) when counting customers"
    enforcement:
      - "Use COUNT(DISTINCT customer_id) for customer counts"
    avoid:
      - "Never use COUNT(*) to count customers — it counts transactions"
    tables: [transactions]
    applied_always: true

  - name: exclude-refunds
    definition: "Revenue metrics must exclude refunded transactions"
    enforcement:
      - "Filter WHERE amount > 0 OR use the total_revenue metric"
    avoid:
      - "Do not sum raw amount without filtering negatives"
    tables: [transactions]
    applied_always: true

guardrail_filters:
  - name: exclude-test-data
    filter: "environment = 'production'"
    tables: [transactions]
    reason: "Always exclude test/dev transactions from analytics"

hierarchies:
  - name: time
    levels: [year, quarter, month, week, date]
    dataset: transactions
    field: txn_date
  - name: geography
    levels: [continent, region, country, city]
    dataset: customers
```

### 2.4 Lineage File (`*.lineage.yaml`)

Upstream and downstream dependency declarations.

```yaml
model: retail-sales

upstream:
  - source: erp.orders
    type: pipeline
    pipeline: dbt-daily-refresh
    refresh: daily
    notes: "Raw orders transformed via dbt into transactions"
  - source: crm.accounts
    type: pipeline
    pipeline: customer-sync
    refresh: hourly

downstream:
  - target: executive-dashboard
    type: dashboard
    tool: tableau
  - target: churn-prediction-model
    type: ml_model
    tool: sagemaker
```

### 2.5 Glossary Term (`*.term.yaml`)

Unchanged from v0.1 concept — business term definitions.

```yaml
id: revenue
definition: "Total value of completed transactions before refunds or adjustments"
synonyms: [sales, gross revenue, top-line]
maps_to: [gross-revenue, net-revenue]
owner: finance-team
tags: [finance, kpi]
```

### 2.6 Owner (`*.owner.yaml`)

Unchanged from v0.1.

```yaml
id: analytics-team
display_name: Analytics Team
email: analytics@company.com
team: data-platform
description: "Responsible for analytics infrastructure and data products"
```

---

## 3. Type System (ContextGraph IR)

The internal representation after compilation.

### Node Kinds

```
semantic_model    # Parsed from *.osi.yaml — the OSI model + datasets + fields + relationships + metrics
governance        # Parsed from *.governance.yaml — ownership, trust, security, grain, field semantics
rules             # Parsed from *.rules.yaml — business rules, golden queries, guardrails, hierarchies
lineage           # Parsed from *.lineage.yaml — upstream/downstream
term              # Parsed from *.term.yaml — glossary
owner             # Parsed from *.owner.yaml — ownership registry
```

### ContextGraph

```typescript
interface ContextGraph {
  models: Map<string, SemanticModelNode>;      // OSI models
  governance: Map<string, GovernanceNode>;      // governance companions
  rules: Map<string, RulesNode>;               // business rules
  lineage: Map<string, LineageNode>;            // lineage
  terms: Map<string, TermNode>;                // glossary
  owners: Map<string, OwnerNode>;              // ownership registry
  indexes: {
    byOwner: Map<string, string[]>;
    byTag: Map<string, string[]>;
    byTrust: Map<string, string[]>;
    bySecurity: Map<string, string[]>;
    modelToGovernance: Map<string, string>;     // model name → governance node id
    modelToRules: Map<string, string>;          // model name → rules node id
    modelToLineage: Map<string, string>;        // model name → lineage node id
  };
}
```

### Key Types

```typescript
// Governance
interface GovernanceNode {
  model: string;                              // OSI model name reference
  owner: string;                              // owner registry reference
  trust: 'endorsed' | 'warning' | 'deprecated';
  security: 'public' | 'internal' | 'confidential' | 'secret';
  tags: string[];
  datasets: Record<string, DatasetGovernance>;
  fields: Record<string, FieldGovernance>;    // "dataset.field" keys
}

interface DatasetGovernance {
  grain: string;
  refresh: string;
  table_type: 'fact' | 'dimension' | 'bridge' | 'snapshot' | 'event' | 'aggregate' | 'view';
  security?: string;
}

interface FieldGovernance {
  semantic_role: 'metric' | 'dimension' | 'identifier' | 'date';
  default_aggregation?: 'SUM' | 'AVG' | 'COUNT' | 'COUNT_DISTINCT' | 'MIN' | 'MAX';
  additive?: boolean;
  default_filter?: string;
  sample_values?: string[];
}

// Rules
interface RulesNode {
  model: string;
  golden_queries: GoldenQuery[];
  business_rules: BusinessRule[];
  guardrail_filters: GuardrailFilter[];
  hierarchies: Hierarchy[];
}

interface GoldenQuery {
  question: string;
  sql: string;
  dialect: string;
  tags?: string[];
}

interface BusinessRule {
  name: string;
  definition: string;
  enforcement: string[];
  avoid: string[];
  tables: string[];
  applied_always: boolean;
}

interface GuardrailFilter {
  name: string;
  filter: string;
  tables: string[];
  reason: string;
}

interface Hierarchy {
  name: string;
  levels: string[];
  dataset: string;
  field?: string;
}

// Lineage
interface LineageNode {
  model: string;
  upstream: LineageEntry[];
  downstream: LineageEntry[];
}

interface LineageEntry {
  source?: string;        // upstream
  target?: string;        // downstream
  type: 'pipeline' | 'dashboard' | 'ml_model' | 'api' | 'manual';
  tool?: string;
  pipeline?: string;
  refresh?: string;
  notes?: string;
}
```

---

## 4. Compiler Pipeline

```
Discover → Parse → Validate → Resolve References → Build Graph → Lint → Compute Tiers → Emit
```

### Phases

1. **Discover**: Glob for `*.osi.yaml`, `*.governance.yaml`, `*.rules.yaml`, `*.lineage.yaml`, `*.term.yaml`, `*.owner.yaml`

2. **Parse**: YAML → raw objects. Detect file type from extension.

3. **Validate**:
   - OSI files: Validate against OSI JSON schema (bundled)
   - Governance files: Validate against ContextKit Zod schemas
   - Rules/lineage/term/owner files: Validate against respective Zod schemas

4. **Resolve References**:
   - `governance.model` → must match an OSI model name
   - `governance.owner` → must match an owner registry entry
   - `governance.datasets.*` → must match dataset names in the referenced OSI model
   - `governance.fields.*` → must match `dataset.field` in the referenced OSI model
   - `rules.model` → must match an OSI model name
   - `rules.business_rules[].tables` → must match dataset names
   - `rules.guardrail_filters[].tables` → must match dataset names
   - `rules.hierarchies[].dataset` → must match dataset name
   - `lineage.model` → must match an OSI model name
   - `term.maps_to` → must match other term IDs
   - `term.owner` → must match owner registry entry

5. **Build Graph**: Create typed maps, populate all indexes.

6. **Lint**: Run all lint rules against the graph. Produce diagnostics.

7. **Compute Tiers**: For each model, evaluate Bronze/Silver/Gold checklists against the combined OSI + governance + rules + lineage data. Output a tier per model.

8. **Emit**: Write manifest JSON with models, governance, rules, lineage, terms, owners, and computed tiers.

---

## 5. Metadata Quality Tiers

Tiers are computed per semantic model. Each tier inherits all requirements from lower tiers.

### Bronze — "Discoverable"

A model passes Bronze if:
1. OSI model has `name` and `description`
2. All datasets have `description`
3. All fields have `description`
4. Governance file exists and specifies `owner` (resolvable)
5. Governance file specifies `security` classification
6. All datasets have `grain` statement
7. All datasets have `table_type`

### Silver — "Trusted"

Bronze requirements plus:
1. `trust` status is set (endorsed/warning/deprecated)
2. At least 2 `tags` on the governance
3. At least one glossary term links to the model (via `tags` overlap or explicit reference)
4. At least one upstream lineage entry exists
5. All datasets have `refresh` cadence
6. At least 2 fields have `sample_values`

### Gold — "AI-Ready"

Silver requirements plus:
1. Every field has `semantic_role` assigned
2. Every metric field has `default_aggregation`
3. Every metric field has `additive` flag set
4. At least one `guardrail_filter` exists
5. At least 3 `golden_queries` exist
6. At least one `business_rule` exists
7. At least one `hierarchy` exists
8. At least one field has `default_filter`
9. Trust status is `endorsed` (not warning/deprecated)
10. Security classification is set at model level AND every dataset with `confidential` or `secret` data has field-level `default_filter` or `guardrail_filter`

### CLI Output

```
$ npx context tier retail-sales

  retail-sales: GOLD

  Bronze (7/7):
    [x] Model has name and description
    [x] All datasets have descriptions
    [x] All fields have descriptions
    [x] Owner assigned (analytics-team)
    [x] Security classification (internal)
    [x] All datasets have grain statements
    [x] All datasets have table_type

  Silver (6/6):
    [x] Trust status (endorsed)
    [x] Tags present (finance, revenue, kpi)
    [x] Glossary linked (revenue)
    [x] Upstream lineage present
    [x] All datasets have refresh cadence
    [x] Sample values on 3 fields

  Gold (10/10):
    [x] All fields have semantic_role
    [x] All metrics have default_aggregation
    [x] All metrics have additive flag
    [x] Guardrail filters present (1)
    [x] Golden queries present (3)
    [x] Business rules present (2)
    [x] Hierarchies present (2)
    [x] Default filters present
    [x] Trust is endorsed
    [x] Security controls adequate
```

---

## 6. Lint Rules

### Retained from v0.1 (adapted)
1. `naming/id-kebab-case` — owner and term IDs must be kebab-case
2. `ownership/required` — all governance files must reference a valid owner
3. `descriptions/required` — OSI models, datasets, fields need descriptions
4. `references/resolvable` — all cross-file references must resolve
5. `glossary/no-duplicate-terms` — no duplicate term IDs
6. `packaging/no-secrets` — no secrets in YAML content

### New for v0.2
7. `osi/valid-schema` — OSI files validate against OSI v1.0 JSON schema
8. `governance/model-exists` — governance file references a valid OSI model
9. `governance/datasets-exist` — governed datasets match OSI model datasets
10. `governance/fields-exist` — governed fields match OSI model fields
11. `governance/grain-required` — all datasets need grain statements (Bronze)
12. `governance/security-required` — security classification required (Bronze)
13. `governance/trust-required` — trust status required (Silver)
14. `governance/refresh-required` — refresh cadence required (Silver)
15. `governance/semantic-role-required` — all fields need semantic_role (Gold)
16. `governance/aggregation-required` — metric fields need default_aggregation (Gold)
17. `governance/additive-required` — metric fields need additive flag (Gold)
18. `rules/golden-queries-minimum` — at least 3 golden queries (Gold)
19. `rules/business-rules-exist` — at least 1 business rule (Gold)
20. `rules/guardrails-exist` — at least 1 guardrail filter (Gold)
21. `rules/hierarchies-exist` — at least 1 hierarchy (Gold)
22. `lineage/upstream-required` — upstream lineage required (Silver)
23. `tier/bronze-requirements` — composite Bronze check
24. `tier/silver-requirements` — composite Silver check
25. `tier/gold-requirements` — composite Gold check

Rules 11-25 are tier-aware: they produce warnings by default but can be configured to error if a project requires a minimum tier.

---

## 7. CLI Commands

```bash
npx context lint                    # Lint all files (OSI + governance + rules + lineage + glossary + owners)
npx context build                   # Compile manifest with tier scores
npx context tier [model-name]       # Show tier status for a model (or all models)
npx context explain <id>            # Look up any node (model, term, owner)
npx context fix --write             # Auto-fix lint issues
npx context dev                     # Watch mode
npx context site build              # Generate docs site with tier badges
npx context serve --stdio           # Start MCP server
npx context init                    # Scaffold a new project with example files
npx context validate-osi <file>     # Validate a file against OSI v1.0 schema
```

New command: `tier` — displays the computed Bronze/Silver/Gold status with a checklist of which requirements pass/fail.

---

## 8. MCP Server

### Resources

| URI | Description |
|-----|-------------|
| `context://manifest` | Full compiled manifest with tiers |
| `context://model/{name}` | OSI model + merged governance + rules + lineage + computed tier |
| `context://model/{name}/schema` | Datasets and fields with semantic roles, aggregations, filters |
| `context://model/{name}/relationships` | Join graph with expressions |
| `context://model/{name}/metrics` | Metrics with SQL expressions and synonyms |
| `context://model/{name}/rules` | Business rules, guardrails, golden queries |
| `context://model/{name}/lineage` | Upstream/downstream dependencies |
| `context://glossary` | All terms |
| `context://tier/{name}` | Tier scorecard for a model |

### Tools

| Tool | Description |
|------|-------------|
| `context_search` | Search across models, datasets, fields, terms, metrics by keyword |
| `context_explain` | Deep explain of any node with related governance, rules, lineage |
| `context_validate` | Run linter and return diagnostics |
| `context_tier` | Compute and return tier status for a model |
| `context_golden_query` | Find golden queries relevant to a natural language question |
| `context_guardrails` | Return all guardrail filters applicable to given tables |

The key MCP innovation for v0.2 is that `context_explain` for a model returns a **merged view**: the OSI semantic model enriched with governance metadata (semantic roles, aggregations, guardrails, business rules, golden queries). This is exactly what an AI agent needs to generate correct SQL.

---

## 9. Site Generator

The docs site adds:
- **Tier badges** on model pages (Bronze/Silver/Gold with color coding)
- **Schema browser** showing datasets → fields with semantic roles and aggregation info
- **Relationship diagram** (text-based) showing join graph
- **Golden query gallery** with copy-to-clipboard SQL
- **Business rules list** with enforcement/avoid patterns
- **Lineage view** showing upstream/downstream
- **Tier scorecard page** per model showing pass/fail checklist

---

## 10. Config

```yaml
# contextkit.config.yaml
context_dir: context
output_dir: dist
minimum_tier: bronze              # fail lint if any model below this tier
lint:
  rules:
    governance/grain-required: error
    rules/golden-queries-minimum: warning
  severity_overrides: {}
site:
  title: "My Data Context"
  base_path: /
mcp:
  transport: stdio
```

New config field: `minimum_tier` — if set, the linter will error (not warn) when any model falls below the specified tier.

---

## 11. Migration from v0.1

Clean break — v0.1 files (`*.ctx.yaml`, `*.policy.yaml`, `*.entity.yaml`) are no longer recognized. The `npx context init` scaffolder generates the new format.

Conceptually:
- v0.1 `concepts` → v0.2 `glossary terms` + fields in governance
- v0.1 `products` → v0.2 `OSI semantic models`
- v0.1 `entities` → v0.2 `datasets` in OSI models
- v0.1 `policies` → v0.2 `governance` files + `rules` files
- v0.1 `terms` → v0.2 `terms` (same)
- v0.1 `owners` → v0.2 `owners` (same, minor format changes)
