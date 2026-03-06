# ContextKit

[![CI](https://github.com/erickittelson/ContextKit/actions/workflows/ci.yml/badge.svg)](https://github.com/erickittelson/ContextKit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@runcontext/core)](https://www.npmjs.com/package/@runcontext/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Your data already has a schema. ContextKit gives it meaning.**

ContextKit is a metadata governance toolkit that transforms raw database schemas into AI-ready semantic layers. Point it at a database, and it scaffolds structured metadata — descriptions, ownership, lineage, business rules, golden queries — then lints, scores, and serves that metadata to AI agents via the Model Context Protocol (MCP).

Built on the [Open Semantic Interchange](https://github.com/open-semantic-interchange/OSI) specification.

---

## Why ContextKit?

AI agents querying databases today face a fundamental problem: they can see table and column names, but they don't understand what the data *means*. They don't know which filters are required, how metrics should be aggregated, or which joins are safe.

ContextKit solves this by creating a governance layer between your database and your AI tools:

```
Database  →  ContextKit  →  AI Agent
(schema)     (meaning)      (correct SQL)
```

Without ContextKit, an agent guesses. With it, the agent knows:
- That `revenue` should be `SUM`'d, never `AVG`'d
- That queries on `transactions` must filter `WHERE status = 'completed'`
- That `customer_id` joins `orders` to `customers` as a many-to-one
- That "demand signal" means review keywords like *wait*, *crowded*, *busy*

---

## Quick Start

### From scratch — point at any database

```bash
npm install -g @runcontext/cli

# Interactive wizard: introspect → scaffold → enrich
context setup
```

### From a new project

```bash
npx create-contextkit my-project
cd my-project
context lint
context tier
```

### From an existing project

```bash
npm install -D @runcontext/cli

# Scaffold metadata from a database
context introspect --db duckdb://warehouse.duckdb

# Enrich to Silver automatically
context enrich --target silver --apply --source default

# See what Gold requires
context tier
```

---

## The Tier System

ContextKit scores metadata maturity on three tiers. Each tier unlocks new capabilities:

### Bronze — Discoverable

The minimum for catalog entry. Data is findable, described, and owned.

| Requirement | What it means |
|---|---|
| Descriptions | Every model, dataset, and field has a human-readable description |
| Ownership | A team or person is accountable |
| Security | Classification level is set |
| Grain | Each dataset declares what a single row represents |
| Table type | Fact, Dimension, Bridge, Snapshot, Event, Aggregate, or View |

### Silver — Trusted

Adds business context and reliability signals. Bridges raw tables to business concepts.

| Requirement | What it means |
|---|---|
| Trust status | Endorsed, Warning, or Deprecated |
| Glossary links | Key columns linked to defined business terms |
| Lineage | Upstream source systems documented |
| Sample values | Representative values for dimension fields |
| Refresh cadence | How often the data updates |
| Tags | Domain and project classification |

### Gold — AI-Ready

Metadata is structured enough for AI agents to autonomously generate correct SQL.

| Requirement | What it means |
|---|---|
| Semantic roles | Every field classified: Dimension, Metric, Identifier, or Date |
| Aggregation rules | Default `SUM`, `AVG`, `COUNT`, or `COUNT DISTINCT` per metric |
| Guardrail filters | Required `WHERE` clauses for correct interpretation |
| Golden queries | Curated SQL templates for common business questions |
| Business rules | Enforcement rules (must-do) and avoid patterns (must-not-do) |
| Hierarchies | Drill paths (e.g., Region → City → Zip) |
| Relationships | Explicit joins with cardinality and nullability |
| AI context | Natural language instructions for AI agents |

**Key insight:** `context introspect` + `context enrich` gets you to Silver automatically. Gold requires human curation — that's where the real value is.

---

## CLI Reference

ContextKit ships 15 commands:

### Core Workflow

```bash
context setup                    # Interactive wizard — database to metadata in one flow
context introspect               # Scan a database → scaffold Bronze-level OSI metadata
context enrich --target silver   # Auto-enrich metadata toward a target tier
context enrich --target gold     # Suggest Gold-level enrichments
context lint                     # Run all lint rules against context files
context fix --write              # Auto-fix lint issues where possible
context build                    # Compile context files → emit manifest JSON
context tier [model]             # Show Bronze/Silver/Gold scorecard
```

### Exploration

```bash
context explain <name>           # Look up any model, term, or owner
context rules                    # List all lint rules with tier, severity, fixability
context validate-osi <file>      # Validate a single OSI file against the schema
context verify                   # Check metadata accuracy against a live database
```

### Serving

```bash
context serve --stdio            # Start MCP server over stdio (for Claude, Cursor, etc.)
context serve --http --port 3000 # Start MCP server over HTTP
context site                     # Generate a static documentation site
context dev                      # Watch mode — re-lint on file changes
context init                     # Scaffold a new project structure
```

---

## File Structure

ContextKit metadata lives in YAML files, organized by concern:

```
context/
├── models/
│   └── sales.osi.yaml              # OSI semantic model — datasets, fields, relationships, metrics
├── governance/
│   └── sales.governance.yaml       # Ownership, trust, security, grain, semantic roles, sample values
├── rules/
│   └── sales.rules.yaml            # Golden queries, business rules, guardrails, hierarchies
├── lineage/
│   └── sales.lineage.yaml          # Upstream sources, downstream dependencies
├── glossary/
│   ├── revenue.term.yaml           # Business term definitions and synonyms
│   └── churn-rate.term.yaml
└── owners/
    └── analytics-team.owner.yaml   # Team ownership records

contextkit.config.yaml               # Project configuration and data source connections
```

**Separation of concerns:** The OSI model file (`*.osi.yaml`) defines the schema. Governance, rules, lineage, and glossary are companion files that ContextKit merges at build time. OSI files are never modified by ContextKit tools.

---

## MCP Server

Expose your entire context graph to AI agents via the [Model Context Protocol](https://modelcontextprotocol.io):

```bash
# stdio transport (for Claude Code, Cursor, etc.)
context serve --stdio

# HTTP transport (for multi-agent or remote setups)
context serve --http --port 3000
```

### Configure in Claude Code

Add to your project's `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "contextkit": {
      "command": "npx",
      "args": ["@runcontext/cli", "serve", "--stdio"]
    }
  }
}
```

Or for HTTP mode:

```json
{
  "mcpServers": {
    "contextkit": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### What the MCP Server Exposes

**Resources** — read-only context an agent can pull:

| Resource | Description |
|---|---|
| `context://manifest` | Full compiled manifest with all models, governance, and rules |
| `context://model/{name}` | Single model with datasets, fields, relationships, metrics |
| `context://glossary` | All business term definitions and synonyms |
| `context://tier/{name}` | Tier scorecard for a model |

**Tools** — actions an agent can invoke:

| Tool | Description |
|---|---|
| `context_search` | Full-text search across models, fields, terms, and owners |
| `context_explain` | Look up any entity by name and get full details |
| `context_validate` | Run lint rules and return diagnostics |
| `context_tier` | Get the current tier scorecard |
| `context_golden_queries` | Retrieve curated SQL templates for a model |
| `context_guardrails` | Get required filters and business rules for safe queries |

---

## 37 Lint Rules

ContextKit ships 37 rules across schema validation, governance, security, data accuracy, and tier requirements:

| Tier | Count | Examples |
|---|---|---|
| **Bronze** | 12 | Descriptions required, ownership required, grain statements, security classification, valid schema, no secrets |
| **Silver** | 3 | Trust status set, refresh cadence, upstream lineage exists |
| **Gold** | 13 | Semantic roles on all fields, aggregation rules for metrics, golden query minimum, relationship coverage, description quality |
| **Data** | 9 | Source tables exist, fields exist, types compatible, sample values accurate, golden queries execute, guardrails valid SQL |

Run `context rules` to see the full list with severity and auto-fix support.

---

## Database Support

ContextKit connects to databases for introspection, enrichment, and verification:

| Adapter | Connection |
|---|---|
| **DuckDB** | `--db duckdb://path/to/file.duckdb` or config `path:` |
| **PostgreSQL** | `--db postgres://user:pass@host:5432/db` |

Configure in `contextkit.config.yaml`:

```yaml
context_dir: context
data_sources:
  default:
    adapter: duckdb
    path: ./warehouse.duckdb
  production:
    adapter: postgres
    connection_string: postgres://user:pass@host:5432/analytics
```

---

## Static Documentation Site

Generate a browsable site from your context files:

```bash
context build && context site
```

Produces a `site/` directory with:
- **Model pages** — datasets, fields, schema browser, rules
- **Glossary** — all business terms with definitions and linked fields
- **Owner pages** — team ownership with governed models
- **Search** — full-text search across all entities
- **Tier badges** — visual Bronze/Silver/Gold status per model

Serve locally or deploy anywhere static files are hosted.

---

## Packages

| Package | Version | Description |
|---|---|---|
| [`@runcontext/core`](https://www.npmjs.com/package/@runcontext/core) | 0.3.3 | Compiler, linter (37 rules), tier engine, fixer, introspector, enricher |
| [`@runcontext/cli`](https://www.npmjs.com/package/@runcontext/cli) | 0.3.3 | CLI with 15 commands |
| [`@runcontext/mcp`](https://www.npmjs.com/package/@runcontext/mcp) | 0.3.3 | MCP server — resources, tools, and prompts for AI agents |
| [`@runcontext/site`](https://www.npmjs.com/package/@runcontext/site) | 0.3.3 | Static documentation site generator |
| [`create-contextkit`](https://www.npmjs.com/package/create-contextkit) | 0.3.3 | Project scaffolder (`npx create-contextkit my-project`) |

---

## End-to-End Example

```bash
# 1. Start with a database
context setup
# → Detects your DuckDB, introspects tables, scaffolds metadata

# 2. Check where you are
context tier
# → my-model: BRONZE

# 3. Auto-enrich to Silver
context enrich --target silver --apply --source default
context tier
# → my-model: SILVER

# 4. Enrich toward Gold (suggests what's missing)
context enrich --target gold --apply --source default
context tier
# → my-model: SILVER (Gold needs human curation)

# 5. Curate: add semantic roles, golden queries, business rules
#    (edit YAML files or let an AI agent do it)
context lint    # see what's still missing
context fix     # auto-fix what it can

# 6. Verify against the live database
context verify
# → ✓ 18 tables exist, ✓ 247 fields match, ✓ 7 golden queries execute

# 7. Build and serve
context build
context site                           # static docs
context serve --http --port 3000       # MCP for AI agents

# 8. Your AI agent now has full semantic context
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
