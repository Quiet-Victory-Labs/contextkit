import * as p from '@clack/prompts';
import path from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import type { SetupContext, StepResult } from '../types.js';

function buildAgentInstructions(ctx: SetupContext): string {
  const modelName = ctx.modelName;
  const tier = ctx.tierScore?.tier?.toUpperCase() ?? 'UNKNOWN';
  const tableList = ctx.tables.map((t) => t.name).join(', ');
  const dbInfo = ctx.dsConfig.path ?? ctx.dsConfig.connection ?? 'configured';

  // Extract dataset info from graph
  const model = ctx.graph?.models.get(modelName);
  const datasets = model?.datasets ?? [];
  const datasetList = datasets.map((ds) => `- \`${ds.name}\` — ${ds.fields?.length ?? 0} fields`).join('\n');

  // Extract failing checks
  const failingChecks: string[] = [];
  if (ctx.tierScore) {
    for (const check of ctx.tierScore.bronze.checks) {
      if (!check.passed) failingChecks.push(`- ${check.id}: ${check.detail ?? check.label}`);
    }
    for (const check of ctx.tierScore.silver.checks) {
      if (!check.passed) failingChecks.push(`- ${check.id}: ${check.detail ?? check.label}`);
    }
    for (const check of ctx.tierScore.gold.checks) {
      if (!check.passed) failingChecks.push(`- ${check.id}: ${check.detail ?? check.label}`);
    }
  }
  const failingSection =
    failingChecks.length > 0
      ? `### Failing Checks\n\n${failingChecks.join('\n')}`
      : 'All checks passing.';

  // Build intent section if user provided goals
  const intentSection = ctx.intent
    ? `## Project Goals

${ctx.intent.goals}
${ctx.intent.metrics ? `\n**Key metrics/outcomes:** ${ctx.intent.metrics}` : ''}
${ctx.intent.audience ? `\n**Audience:** ${ctx.intent.audience}` : ''}

Use these goals to prioritize which datasets, fields, and metrics to curate first.

`
    : '';

  return `# ContextKit Agent Instructions

Model: **${modelName}** | Current Tier: **${tier}**
Database: ${ctx.dsConfig.adapter} (${dbInfo})
Tables: ${tableList}

${intentSection}## The Cardinal Rule: Never Fabricate Metadata

**Every piece of metadata you write must be grounded in evidence from the actual data.**

- NEVER invent owner names, emails, team names, or contact info
- NEVER write a field description that is just the column name repeated
- NEVER assign a semantic_role without first querying the column's actual values
- NEVER mark a field as additive without understanding what summing it means
- NEVER write lineage entries without knowing the actual data sources
- NEVER write a business_context narrative you can't justify from the data
- NEVER create a glossary definition that is just "Definition for X"

If you don't know something, **ask the user**. A honest "I'm not sure — can you tell me what this field means?" is infinitely better than fabricated metadata that looks plausible but is wrong.

## Database Safety — MANDATORY

**Your job is to READ the database to build metadata. You must NEVER modify the database.**

### Hard Rules (no exceptions)

- **READ-ONLY.** Never execute INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, MERGE, REPLACE, or any DDL/DML statement
- **LIMIT everything.** Every SELECT must include \`LIMIT\`. Use \`LIMIT 20\` for sample values, \`LIMIT 100\` max for golden query validation. Never run unlimited queries
- **No full table scans.** Never \`SELECT * FROM large_table\` without a WHERE clause and LIMIT. For row counts, use \`COUNT(*)\` — never pull all rows to count them
- **No expensive aggregations.** Avoid \`GROUP BY\` on high-cardinality columns across full tables. When checking distinct values, use \`SELECT DISTINCT col FROM table LIMIT 20\`, not \`SELECT DISTINCT col FROM table\`
- **No cross joins or cartesian products.** Never join tables without a proper join condition
- **No recursive or deeply nested queries.** Keep queries simple — you're sampling data, not building reports
- **No EXPLAIN ANALYZE on cloud warehouses.** On Snowflake, BigQuery, Databricks, etc., even EXPLAIN can trigger computation. Use metadata queries (information_schema) instead when possible

### Cost Awareness

Cloud data warehouses (Snowflake, BigQuery, Databricks, Redshift) charge per query based on data scanned. **Every query costs money.**

- Prefer \`information_schema\` queries over scanning actual tables
- Use \`LIMIT\` on every query — no exceptions
- Sample a few rows to understand a column, don't scan the full table
- For BigQuery: always qualify table names with dataset to avoid scanning wrong tables
- For Snowflake: use \`SAMPLE\` clause when available instead of full table scans
- If you need row counts, use table metadata or \`COUNT(*)\` — never \`SELECT *\`
- Batch your questions: gather what you need to know, then write ONE efficient query instead of many small ones

### What You ARE Allowed To Do

\`\`\`sql
-- YES: Sample values (always with LIMIT)
SELECT DISTINCT column_name FROM table_name LIMIT 20;

-- YES: Basic stats for a column (single column, not full row)
SELECT MIN(col), MAX(col), COUNT(DISTINCT col) FROM table_name;

-- YES: Row count
SELECT COUNT(*) FROM table_name;

-- YES: Schema metadata (free or near-free on all platforms)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'my_table';

-- YES: Validate a golden query (with LIMIT)
SELECT geoid, score FROM vw_rankings ORDER BY score DESC LIMIT 10;
\`\`\`

### What You Must NEVER Do

\`\`\`sql
-- NEVER: Modify data
INSERT INTO / UPDATE / DELETE FROM / DROP TABLE / ALTER TABLE

-- NEVER: Unlimited scans
SELECT * FROM large_table;
SELECT DISTINCT high_cardinality_col FROM big_table;

-- NEVER: Expensive cross-table operations without LIMIT
SELECT * FROM a JOIN b ON a.id = b.id JOIN c ON b.id = c.id;

-- NEVER: Write to the database in any way
CREATE TABLE / CREATE VIEW / CREATE INDEX
\`\`\`

If a query might be expensive and you're not sure, **ask the user first**. "This table looks large — is it OK if I run a COUNT(*)?" is always the right call.

## Reference Documents

Check \`context/reference/\` for any files the user has provided — data dictionaries, Confluence exports, ERDs, business glossaries, dashboard docs, etc. **Read these first** before querying the database. They contain domain knowledge that will dramatically improve your metadata quality.

If the folder is empty, ask the user: "Do you have any existing documentation about this data? Data dictionaries, wiki pages, spreadsheets? Drop them in context/reference/ and I'll use them."

## On Session Start

1. Check \`context/reference/\` for any reference documents — read them if present
2. Run \`context tier\` to check the current metadata tier (Bronze/Silver/Gold)
3. Report the current tier and summarize failing checks
4. Ask the user what they'd like to focus on — don't start changing files unprompted
5. If the user says "get me to Gold" or "build my semantic layer," follow the iterative workflow below

## The Iterative Workflow

Building a semantic layer is a **conversation**. You and the user go back and forth — you query the data, propose metadata, ask questions, and iterate. Here's the loop:

\`\`\`
                    ┌─────────────────────────┐
                    │   context tier           │
                    │   (check failing checks) │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  Pick highest-impact     │
                    │  failing check           │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  Query the database      │
                    │  to gather evidence      │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  Need user input?        │──── YES ──→ Ask the user
                    └──────────┬──────────────┘              (then continue)
                               │ NO
                    ┌──────────▼──────────────┐
                    │  Edit YAML metadata      │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  context lint            │
                    │  context tier            │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  All Gold checks pass?   │──── NO ──→ Loop back
                    └──────────┬──────────────┘
                               │ YES
                            ✓ DONE
\`\`\`

### What to Ask the User About

You know the data. The user knows the business. Ask them about:

- **Ownership** — "Who owns this data? What team maintains it?"
- **Metric intent** — "Should revenue be summed or averaged? Is this an additive metric?"
- **Business rules** — "Are there any filters that should always be applied? (e.g., only active records)"
- **Data lineage** — "Where does this data come from originally? What upstream system?"
- **Use cases** — "What questions do people ask this data? What dashboards use it?"
- **Glossary terms** — "What does 'churn rate' mean in your organization?"
- **Data quality** — "I see 15% null values in this column — is that expected?"

Don't batch all questions at once. Ask as you encounter each field or concept that needs clarification.

### CLI Commands to Use

\`\`\`bash
# Check where you are
context tier                    # Show Bronze/Silver/Gold scorecard with failing checks
context lint                    # Run all 40 lint rules
context explain ${modelName}     # Full model details — governance, rules, lineage, tier

# Build and fix
context enrich --target silver --apply --source default  # Auto-enrich to Silver
context fix --write             # Auto-fix lint issues where possible
context verify                  # Validate metadata against the live database

# Serve to other agents
context serve --stdio           # Start MCP server (for Claude, Cursor, etc.)
context dev --studio            # Open visual editor in browser
\`\`\`

### Do NOT Stop Until Gold

1. Run \`context tier\` and collect every failing check
2. For each failing check, query the database to gather evidence, then fix the metadata
3. Run \`context tier\` again
4. If checks still fail, go back to step 2
5. **Do NOT stop until every Gold check passes** or you hit something that genuinely requires human input
6. For checks you cannot fix, ask the user or leave a clear TODO explaining what's needed

You must iterate — a single pass is never enough. Each \`context tier\` run may reveal new failures after earlier ones are fixed.

## How to Curate Metadata (the right way)

### Before writing ANY metadata, query the database first

For every field you're about to describe or classify (**always with LIMIT, always read-only**):

\`\`\`sql
-- What type of values does this column contain?
SELECT DISTINCT column_name FROM table LIMIT 20;

-- For numeric columns: is this a metric or dimension?
SELECT MIN(col), MAX(col), AVG(col), COUNT(DISTINCT col) FROM table LIMIT 1;

-- For potential metrics: does SUM make sense?
-- If SUM produces a meaningful business number → additive: true
-- If SUM is meaningless (e.g., summing percentages, scores, ratings) → additive: false

-- REMEMBER: Never run queries without LIMIT. Never modify data.
\`\`\`

### Semantic Role Decision Tree

Query the column first, then apply this logic:

1. **Is it a primary key or foreign key?** → \`identifier\`
2. **Is it a date or timestamp?** → \`date\`
3. **Is it numeric AND does aggregation make business sense?**
   - Does SUM make sense? (counts, amounts, quantities) → \`metric\`, \`additive: true\`
   - Does only AVG/MIN/MAX make sense? (rates, percentages, scores, ratings) → \`metric\`, \`additive: false\`
4. **Everything else** → \`dimension\`

Common mistakes to avoid:
- \`stars\` (ratings) → metric with AVG, NOT additive (summing star ratings is meaningless)
- \`_per_10k_people\` (rates) → metric with AVG, NOT additive
- \`_score\` (composite scores) → metric with AVG, NOT additive
- \`useful/funny/cool\` (vote counts) → metric with SUM, additive
- \`_count\` fields → metric with SUM, additive (usually)

### Field Descriptions

Write descriptions that help someone who has never seen this database understand what the column contains. Include:
- What the value represents
- Units or scale (if applicable)
- Where the data comes from (if known)
- Any known quirks or caveats

Bad: \`description: total_population\`
Good: \`description: Total resident population of the census tract from American Community Survey 5-year estimates\`

Bad: \`description: stars\`
Good: \`description: Average Yelp star rating (1.0-5.0 scale) based on all reviews for this business\`

### Lineage

Upstream sources are the EXTERNAL systems that feed data into this warehouse. They are NOT the tables in the warehouse itself.

Ask yourself: "Where did this data originally come from before it was loaded here?"

Bad lineage:
\`\`\`yaml
upstream:
  - source: yelp_business    # This is a table IN the warehouse, not an upstream source
    type: pipeline
\`\`\`

Good lineage:
\`\`\`yaml
upstream:
  - source: yelp-academic-dataset
    type: file
    notes: Yelp Open Dataset (academic use), loaded via CSV import
\`\`\`

### Owner Files

Do NOT create fake owner identities. If the real owner is unknown:
- Keep the existing owner file as-is
- Note in the file that contact info needs to be filled in by a real person
- NEVER invent email addresses like \`analytics@example.com\`

### Business Context

Write business_context entries that describe real analytical use cases you can verify from the data. Query the data to understand what questions it can answer before writing narratives.

### Golden Queries

Every golden query MUST be tested against the actual database before you write it. Run the SQL, verify it returns sensible results, then document it.

### Data Quality

When you discover data quality issues (null values, broken joins, missing data), FLAG THEM — don't hide them. Add notes in governance or report them to the user.

## This Project

### Datasets

${datasetList || '(none detected)'}

${failingSection}

## Serving to Other Agents via MCP

Once the semantic layer reaches Silver or Gold, serve it so other AI agents can use the curated metadata:

\`\`\`bash
# Start MCP server (agents connect via stdio)
context serve --stdio

# Or via HTTP for remote/multi-agent setups
context serve --http --port 3000
\`\`\`

To add ContextKit as an MCP server in another agent's config:

\`\`\`json
{
  "mcpServers": {
    "contextkit": {
      "command": "npx",
      "args": ["@runcontext/cli", "serve", "--stdio"]
    }
  }
}
\`\`\`

### Exporting AI Blueprints

Export the Gold-tier outcome as a portable YAML file:

\`\`\`bash
context blueprint ${modelName}
# → blueprints/${modelName}.data-product.osi.yaml
\`\`\`

This AI Blueprint contains the complete semantic specification — share it, serve it via MCP, or import it into any OSI-compliant tool.

## MCP Tools (if using ContextKit as an MCP server)

| Tool | Parameters | What it does |
|------|-----------|-------------|
| \`context_search\` | \`query\` | Find models, datasets, fields, terms by keyword |
| \`context_explain\` | \`model\` | Full model details — governance, rules, lineage, tier |
| \`context_validate\` | — | Run linter, get errors and warnings |
| \`context_tier\` | \`model\` | Tier scorecard with all check results |
| \`context_golden_query\` | \`question\` | Find pre-validated SQL for a question |
| \`context_guardrails\` | \`tables[]\` | Get required WHERE clauses for tables |

## Tier Checks Quick Reference

**Bronze (7):** descriptions, owner, security, grain, table_type
**Silver (+6):** trust, 2+ tags, glossary linked, lineage, refresh, 2+ sample_values
**Gold (+24):** semantic_role on ALL fields, metric aggregation/additive, 1+ guardrail, 3+ golden queries, 1+ business rule, 1+ hierarchy, 1+ default_filter, trust=endorsed, contactable owner, 1+ relationship, description ≥50 chars, ai_context (no TODO), 1+ business_context, version, field descriptions not lazy, glossary definitions substantive, lineage references real sources, grain statements specific, ai_context filled in, 3+ relationships (models with 3+ datasets), 1+ computed metric, 3+ glossary terms (models with 5+ datasets)

## How to Reach Gold: Curation Recipes

### Metrics (gold/metrics-defined)

Inspect computed views in the database. Any calculated column is a candidate metric.

\`\`\`sql
-- Find computed columns in views (information_schema queries are free/cheap)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name LIKE 'vw_%' AND data_type IN ('DOUBLE', 'FLOAT', 'INTEGER', 'BIGINT', 'DECIMAL')
LIMIT 100;
\`\`\`

For each computed column (e.g., \`opportunity_score\`, \`shops_per_10k\`, \`demand_signal_pct\`):
1. Query it to understand what it measures
2. Add it to the model's \`metrics[]\` array in the OSI YAML
3. Include the SQL expression, aggregation type (SUM/AVG), and a human description
4. Mark whether it's additive (can be summed across dimensions)

Example:
\`\`\`yaml
metrics:
  - name: opportunity_score
    expression:
      dialects:
        - dialect: DuckDB
          expression: "(population/10000)*2 + (income/50000)*2 + (10-shops_per_10k)*3 + transit*1.5 + demand*0.5"
    description: Composite score ranking census tracts for coffee shop viability
    aggregation: AVG
    additive: false
\`\`\`

### Glossary Terms (gold/glossary-coverage)

For each key business concept your model measures, create a glossary term file.

Think about the terms a new analyst would need defined:
- What is "supply saturation"? (> 5.0 shops per 10k people)
- What is a "demand signal"? (review mentioning wait/line/crowded/busy)
- What is "opportunity score"? (composite ranking formula)

For each term, create \`context/glossary/<term-name>.term.yaml\`:
\`\`\`yaml
term: supply-saturation
definition: >
  A measure of coffee shop density per census tract. Calculated as
  shops per 10,000 residents. Tracts with > 5.0 are considered saturated.
owner: analytics-team
tags: [coffee-analytics]
\`\`\`

Models with 5+ datasets need at least 3 glossary terms linked by shared tags or owner.

### Relationships (gold/relationships-coverage)

For each join in the SQL views, define a relationship in the OSI model.

\`\`\`sql
-- Find joins by examining view definitions (metadata query, low cost)
-- Look for patterns: ON table_a.col = table_b.col
-- Or spatial joins: ABS(a.lat - b.lat) < threshold
-- NEVER run the actual joins yourself to "test" them — just document the relationship
\`\`\`

For each join:
\`\`\`yaml
relationships:
  - name: business-to-tract
    left_dataset: yelp_business
    right_dataset: census_tract
    join_type: spatial
    cardinality: many-to-one
    description: Businesses assigned to nearest census tract within 0.02 degrees (~1 mile)
\`\`\`

Models with 3+ datasets need at least 3 relationships.

### Golden Queries

Write 3-5 SQL queries answering common business questions. **Test each query with LIMIT first!**

\`\`\`sql
-- Validate with LIMIT (never run unbounded queries to "test"):
SELECT geoid, tract_name, opportunity_score
FROM vw_candidate_zones ORDER BY opportunity_score DESC LIMIT 10;

-- The golden query YAML can document the full query, but when you TEST it, always use LIMIT
\`\`\`

## YAML Formats

**Governance** (\`context/governance/*.governance.yaml\`):
\`\`\`yaml
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
\`\`\`

**Rules** (\`context/rules/*.rules.yaml\`):
\`\`\`yaml
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
\`\`\`

## File Structure

\`\`\`
context/
  models/*.osi.yaml              # OSI semantic model (schema, relationships, metrics)
  governance/*.governance.yaml   # Ownership, trust, security, semantic roles
  rules/*.rules.yaml             # Golden queries, business rules, guardrails
  lineage/*.lineage.yaml         # Upstream sources
  glossary/*.term.yaml           # Business term definitions
  owners/*.owner.yaml            # Team ownership records
  reference/                     # User-provided docs (data dictionaries, wiki exports, etc.)
  AGENT_INSTRUCTIONS.md          # This file
\`\`\`
`;
}

export async function runAgentInstructionsStep(ctx: SetupContext): Promise<StepResult> {
  const instructionsPath = path.join(ctx.contextDir, 'AGENT_INSTRUCTIONS.md');

  if (existsSync(instructionsPath)) {
    const shouldOverwrite = await p.confirm({
      message: 'context/AGENT_INSTRUCTIONS.md already exists. Overwrite with updated instructions?',
    });
    if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
      return { skipped: true, summary: 'context/AGENT_INSTRUCTIONS.md already exists, kept existing' };
    }
  }

  const content = buildAgentInstructions(ctx);
  writeFileSync(instructionsPath, content, 'utf-8');

  p.log.success('Generated context/AGENT_INSTRUCTIONS.md — the agent curation guide');

  return { skipped: false, summary: 'Generated context/AGENT_INSTRUCTIONS.md' };
}
