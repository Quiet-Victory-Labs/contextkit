# RunContext Agent Instructions

You have two MCP servers: **duckdb** (query data) and **runcontext** (query metadata).

## The Cardinal Rule: Never Fabricate Metadata

**Every piece of metadata you write must be grounded in evidence from the actual data.**

- NEVER invent owner names, emails, team names, or contact info
- NEVER write a field description that is just the column name repeated
- NEVER assign a semantic_role without first querying the column's actual values
- NEVER mark a field as additive without understanding what summing it means
- NEVER write lineage entries without knowing the actual data sources
- NEVER write a business_context narrative you can't justify from the data
- NEVER create a glossary definition that is just "Definition for X"

If you don't know something, say so. Leave it as a TODO with a note about what you'd need to determine the answer. A honest TODO is infinitely better than fabricated metadata that looks plausible but is wrong.

## On Session Start

1. Run `context_tier` to check the current metadata tier (Bronze/Silver/Gold)
2. Report the current tier and list failing checks
3. Ask the user what they'd like to work on — don't start changing files unprompted

## When Asked to Reach Gold

Work through ALL failing Gold checks iteratively until `context tier` reports Gold:

1. Run `context_tier` and collect every failing check
2. For each failing check, query the database to gather evidence, then fix the metadata
3. Run `context_tier` again
4. If checks still fail, go back to step 2
5. **Do NOT stop until every Gold check passes** or you hit something that genuinely requires human input (like real owner contact info)
6. For checks you cannot fix (e.g., owner email), leave a clear TODO explaining what a human needs to provide

You must iterate — a single pass is never enough. Each `context tier` run may reveal new failures after earlier ones are fixed.

## How to Curate Metadata (the right way)

### Before writing ANY metadata, query the database first

For every field you're about to describe or classify:

```sql
-- What type of values does this column contain?
SELECT DISTINCT column_name FROM table LIMIT 20;

-- For numeric columns: is this a metric or dimension?
SELECT MIN(col), MAX(col), AVG(col), COUNT(DISTINCT col) FROM table;

-- For potential metrics: does SUM make sense?
-- If SUM produces a meaningful business number → additive: true
-- If SUM is meaningless (e.g., summing percentages, scores, ratings) → additive: false
```

### Semantic Role Decision Tree

Query the column first, then apply this logic:

1. **Is it a primary key or foreign key?** → `identifier`
2. **Is it a date or timestamp?** → `date`
3. **Is it numeric AND does aggregation make business sense?**
   - Does SUM make sense? (counts, amounts, quantities) → `metric`, `additive: true`
   - Does only AVG/MIN/MAX make sense? (rates, percentages, scores, ratings) → `metric`, `additive: false`
4. **Everything else** → `dimension`

Common mistakes to avoid:
- `stars` (ratings) → metric with AVG, NOT additive (summing star ratings is meaningless)
- `_per_10k_people` (rates) → metric with AVG, NOT additive
- `_score` (composite scores) → metric with AVG, NOT additive
- `useful/funny/cool` (vote counts) → metric with SUM, additive
- `_count` fields → metric with SUM, additive (usually)

### Field Descriptions

Write descriptions that help someone who has never seen this database understand what the column contains. Include:
- What the value represents
- Units or scale (if applicable)
- Where the data comes from (if known)
- Any known quirks or caveats

Bad: `description: total_population`
Good: `description: Total resident population of the census tract from American Community Survey 5-year estimates`

### Lineage

Upstream sources are the EXTERNAL systems that feed data into this warehouse. They are NOT the tables in the warehouse itself.

Ask yourself: "Where did this data originally come from before it was loaded here?"

### Owner Files

Do NOT create fake owner identities. If the real owner is unknown:
- Keep the existing owner file as-is
- Note in the file that contact info needs to be filled in by a real person
- NEVER invent email addresses like `analytics@example.com`

### Business Context

Write business_context entries that describe real analytical use cases you can verify from the data. Query the data to understand what questions it can answer before writing narratives.

### Golden Queries

Every golden query MUST be tested against the actual database before you write it. Run the SQL, verify it returns sensible results, then document it.

### Data Quality

When you discover data quality issues (null values, broken joins, missing data), FLAG THEM — don't hide them. Add notes in governance or report them to the user.

## MCP Tools

| Tool | Parameters | What it does |
|------|-----------|-------------|
| `context_search` | `query` | Find models, datasets, fields, terms by keyword |
| `context_explain` | `model` | Full model details — governance, rules, lineage, tier |
| `context_validate` | — | Run linter, get errors and warnings |
| `context_tier` | `model` | Tier scorecard with all check results |
| `context_golden_query` | `question` | Find pre-validated SQL for a question |
| `context_guardrails` | `tables[]` | Get required WHERE clauses for tables |

## Tier Checks Quick Reference

**Bronze (7):** descriptions, owner, security, grain, table_type
**Silver (+6):** trust, 2+ tags, glossary linked, lineage, refresh, 2+ sample_values
**Gold (+24):** semantic_role on ALL fields, metric aggregation/additive, 1+ guardrail, 3+ golden queries, 1+ business rule, 1+ hierarchy, 1+ default_filter, trust=endorsed, contactable owner, 1+ relationship, description >=50 chars, ai_context (no TODO), 1+ business_context, version, field descriptions not lazy, glossary definitions substantive, lineage references real sources, grain statements specific, ai_context filled in, 3+ relationships (models with 3+ datasets), 1+ computed metric, 3+ glossary terms (models with 5+ datasets)

## How to Reach Gold: Curation Recipes

### Metrics (gold/metrics-defined)

Inspect computed views in the database. Any calculated column is a candidate metric.

```sql
-- Find computed columns in views
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name LIKE 'vw_%' AND data_type IN ('DOUBLE', 'FLOAT', 'INTEGER', 'BIGINT', 'DECIMAL');
```

For each computed column (e.g., `opportunity_score`, `shops_per_10k`, `demand_signal_pct`):
1. Query it to understand what it measures
2. Add it to the model's `metrics[]` array in the OSI YAML
3. Include the SQL expression, aggregation type (SUM/AVG), and a human description
4. Mark whether it's additive (can be summed across dimensions)

Example:
```yaml
metrics:
  - name: opportunity_score
    expression:
      dialects:
        - dialect: DuckDB
          expression: "(population/10000)*2 + (income/50000)*2 + (10-shops_per_10k)*3 + transit*1.5 + demand*0.5"
    description: Composite score ranking census tracts for coffee shop viability
    aggregation: AVG
    additive: false
```

### Glossary Terms (gold/glossary-coverage)

For each key business concept your model measures, create a glossary term file.

Think about the terms a new analyst would need defined:
- What is "supply saturation"? (> 5.0 shops per 10k people)
- What is a "demand signal"? (review mentioning wait/line/crowded/busy)
- What is "opportunity score"? (composite ranking formula)

For each term, create `context/glossary/<term-name>.term.yaml`:
```yaml
term: supply-saturation
definition: >
  A measure of coffee shop density per census tract. Calculated as
  shops per 10,000 residents. Tracts with > 5.0 are considered saturated.
owner: analytics-team
tags: [coffee-analytics]
```

Models with 5+ datasets need at least 3 glossary terms linked by shared tags or owner.

### Relationships (gold/relationships-coverage)

For each join in the SQL views, define a relationship in the OSI model.

```sql
-- Find joins by examining view definitions
-- Look for patterns: ON table_a.col = table_b.col
-- Or spatial joins: ABS(a.lat - b.lat) < threshold
```

For each join:
```yaml
relationships:
  - name: business-to-tract
    left_dataset: yelp_business
    right_dataset: census_tract
    join_type: spatial
    cardinality: many-to-one
    description: Businesses assigned to nearest census tract within 0.02 degrees (~1 mile)
```

Models with 3+ datasets need at least 3 relationships.

### Golden Queries

Write 3-5 SQL queries answering common business questions. **Test each query first!**

```sql
-- Run the query, verify it returns sensible results, then document:
SELECT geoid, tract_name, opportunity_score
FROM vw_candidate_zones ORDER BY opportunity_score DESC LIMIT 10;
```

## YAML Formats

**Governance** (`context/governance/*.governance.yaml`):
```yaml
model: my-model
owner: team-name
version: "1.0.0"
trust: endorsed
security: internal
tags: [domain-tag-1, domain-tag-2]
business_context:
  - name: Use Case Name
    description: What analytical question this data answers and for whom.
datasets:
  my_table:
    grain: "One row per [entity] identified by [key]"
    table_type: fact    # fact | dimension | event | view
    refresh: daily
fields:
  dataset.field:
    semantic_role: metric        # metric | dimension | identifier | date
    default_aggregation: SUM     # SUM | AVG | COUNT | COUNT_DISTINCT | MIN | MAX
    additive: true               # can this metric be summed across dimensions?
    default_filter: "is_open = 1"
    sample_values: ["val1", "val2"]
```

**Rules** (`context/rules/*.rules.yaml`):
```yaml
model: my-model
golden_queries:
  - question: What are the top items by count?
    sql: SELECT name, count FROM my_table ORDER BY count DESC LIMIT 10
    intent: Identify top performers by volume
    caveats: Filters to active records only
business_rules:
  - name: valid-ratings
    definition: All ratings must be between 1 and 5
guardrail_filters:
  - name: active-only
    filter: "status = 'active'"
    reason: Exclude inactive records from analytics
    tables: [my_table]
hierarchies:
  - name: geography
    levels: [state, city, postal_code]
    dataset: my_table
```

## CLI Commands

```bash
context tier                  # Check scorecard
context verify --db <path>    # Validate against live data
context fix --db <path>       # Auto-fix data warnings
context setup                 # Interactive setup wizard
context dev                   # Watch mode for live editing
```
