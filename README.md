<h1 align="center">ContextKit</h1>

<p align="center">
  <strong>Turn your database into an AI-ready data product.</strong>
</p>

<p align="center">
  Fill out a Context Brief about your data. ContextKit connects to your database, introspects the schema, and builds a <b>semantic plane</b> — a structured metadata layer that tells AI agents what your data means, how to query it safely, and which business rules apply. Serve it to Claude Code, Cursor, Copilot, or any MCP-compatible tool.
</p>

<p align="center">
  <a href="https://github.com/Quiet-Victory-Labs/contextkit/actions/workflows/ci.yml"><img src="https://github.com/Quiet-Victory-Labs/contextkit/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@runcontext/cli"><img src="https://img.shields.io/npm/v/@runcontext/cli" alt="npm" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://github.com/open-semantic-interchange/OSI"><img src="https://img.shields.io/badge/OSI-Open_Semantic_Interchange-c9a55a" alt="OSI" /></a>
</p>

---

### Works with

`Claude Code` · `Cursor` · `Copilot` · `Windsurf` · `Codex` — any MCP-compatible AI tool.

---

## How It Works

```
1. context setup          → Opens a browser wizard
2. Fill out Context Brief → Name, owner, sensitivity, connect database
3. Pipeline runs          → Introspect → Scaffold → Enrich → Verify
4. context serve          → MCP server live — AI agents have full context
```

**Step 1 — Context Brief.** Run `context setup` and a 5-step wizard opens in your browser. Name your data product, set an owner, choose a sensitivity level, and connect your database. Upload any existing documentation (SQL files, data dictionaries, markdown) to give the enrichment engine more to work with.

**Step 2 — Automatic Pipeline.** ContextKit introspects your schema, scaffolds Bronze-tier metadata (descriptions, types, ownership), then auto-enriches toward Silver (trust status, glossary, lineage, sample values). The pipeline runs in real time — you watch each stage complete.

**Step 3 — Curate to Gold.** Open the visual studio (`context dev --studio`) to add semantic roles, aggregation rules, guardrail filters, golden queries, and business rules. This is what makes AI agents generate correct SQL instead of guessing. Gold tier requires your business knowledge — and that's where the real value is.

**Step 4 — Serve via MCP.** Run `context serve` and every AI tool in your stack gets access to your semantic plane. Agents can search your metadata, look up business terms, retrieve guardrail filters, and find golden queries — all through the Model Context Protocol.

---

## Quickstart

```bash
npx create-contextkit my-data
cd my-data
context setup
```

The wizard opens in your browser. Fill out the Context Brief, connect your database, and the pipeline handles the rest.

Or tell your AI agent:

> *"Install @runcontext/cli and build a semantic layer for my database."*

---

## The Tiers

**Bronze — Discoverable.** Every model, field, and dataset has a description, an owner, and a security classification. Achieved automatically via `context introspect`.

**Silver — Trusted.** Adds trust status, glossary links, lineage, sample values, and refresh cadence. Achieved via `context enrich --target silver`. AI can interpret the data but still lacks guardrails.

**Gold — AI-Ready.** Semantic roles, aggregation rules, guardrail filters, golden queries, business rules, and explicit relationships. Curated by you in the visual studio. This is what makes agents generate correct SQL on the first try.

---

## Commands

```bash
# Guided setup
context setup                    # 5-step browser wizard — database to data product in one flow
context dev --studio             # Visual editor — curate metadata, see tier updates live

# Build pipeline
context introspect --db <url>    # Connect database, scaffold Bronze metadata
context enrich --target silver   # Auto-enrich toward Silver tier
context enrich --target gold     # Suggest Gold-tier enrichments
context build                    # Compile semantic plane → manifest JSON

# Quality & validation
context tier [model]             # Show Bronze/Silver/Gold scorecard
context lint                     # Run 40 lint rules
context fix --write              # Auto-fix lint issues
context verify --db <url>        # Check metadata accuracy against live database

# Serve & export
context serve --stdio            # MCP server for AI agents (stdio)
context serve --http --port 3000 # MCP server (HTTP)
context blueprint [model]        # Export portable AI Blueprint (OSI YAML)
context site                     # Generate browsable documentation site
```

---

## Database Support

PostgreSQL, DuckDB, MySQL, SQL Server, SQLite, Snowflake, BigQuery, ClickHouse, Databricks.

---

## MCP Server

Add ContextKit as an MCP server so AI agents discover your semantic plane automatically:

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

**8 MCP tools:** search, explain, validate, tier, golden-queries, guardrails, list-products, get-product.

---

## Local-first, Cloud-ready

ContextKit runs entirely on your machine. Connect any database, curate metadata locally, serve via MCP — free and open source.

Need collaboration, hosted MCP, or team workflows? **[RunContext Cloud](https://runcontext.dev)** adds multi-user curation, hosted serving, and managed infrastructure on top of the same open core.

---

## Open Semantic Interchange

ContextKit metadata follows the [Open Semantic Interchange (OSI)](https://github.com/open-semantic-interchange/OSI) specification — a vendor-neutral format for describing data products. Export your semantic plane as portable YAML. Import it into any OSI-compliant tool. No lock-in.

---

## Packages

| Package | Description |
|---|---|
| [`@runcontext/cli`](https://www.npmjs.com/package/@runcontext/cli) | CLI — setup wizard, introspect, enrich, build, serve |
| [`@runcontext/core`](https://www.npmjs.com/package/@runcontext/core) | Compiler, linter, tier engine, 40 lint rules |
| [`@runcontext/mcp`](https://www.npmjs.com/package/@runcontext/mcp) | MCP server — 8 tools for AI agents |
| [`@runcontext/ui`](https://www.npmjs.com/package/@runcontext/ui) | Browser-based Context Brief wizard and visual studio |
| [`@runcontext/site`](https://www.npmjs.com/package/@runcontext/site) | Documentation site generator with search and tier badges |
| [`create-contextkit`](https://www.npmjs.com/package/create-contextkit) | Project scaffolder — `npx create-contextkit` |

---

## Links

- [Documentation](https://contextkit.dev)
- [npm](https://www.npmjs.com/package/@runcontext/cli)
- [RunContext Cloud](https://runcontext.dev)

## License

MIT
