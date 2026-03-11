# @runcontext/cli

**Turn your database into an AI-ready semantic plane.**

Run `context setup` and a 6-step wizard walks you through everything: connect your database, define your semantic plane, scaffold metadata, checkpoint at Bronze, hand off to your AI agent for curation to Gold, and serve the result via MCP.

Works with Claude Code, Cursor, Copilot, Windsurf, Codex, and any MCP-compatible AI tool. Supports PostgreSQL, DuckDB, MySQL, SQL Server, SQLite, Snowflake, BigQuery, ClickHouse, and Databricks.

## Installation

```bash
npm install @runcontext/cli
```

## Quick Start

```bash
context setup
# → 6-step wizard: Connect > Define > Scaffold > Checkpoint > Curate > Serve
# → Your semantic plane is ready
```

Or tell your AI agent:

> *"Install @runcontext/cli and build a semantic plane for my database."*

## Setup Wizard Steps

1. **Connect** — Point to your database
2. **Define** — Name your semantic plane, set owner and sensitivity
3. **Scaffold** — Introspect the schema, generate Bronze metadata
4. **Checkpoint** — Review and lock the Bronze baseline
5. **Curate** — Hand off to your AI agent (Claude Code, Cursor, Copilot) which uses MCP to query the database and write Gold-quality metadata
6. **Serve** — MCP server goes live, AI agents get full context

## Commands

```bash
# Guided setup
context setup                    # 6-step wizard — database to semantic plane

# Build pipeline
context new <name>               # Scaffold a new semantic plane manually
context introspect --db <url>    # Connect database, scaffold Bronze metadata
context enrich --target silver   # Auto-enrich toward Silver tier
context build                    # Compile semantic plane → manifest JSON
context tier [model]             # Show Bronze/Silver/Gold scorecard

# Quality
context lint                     # Run lint rules
context fix --write              # Auto-fix lint issues
context verify --db <url>        # Check accuracy against live database

# Serve & export
context serve --stdio            # MCP server (stdio — for Claude Code, Cursor, etc.)
context serve --http --port 3000 # MCP server (HTTP)
context blueprint [model]        # Export portable AI Blueprint (OSI YAML)
context site                     # Generate browsable documentation site
context explain <name>           # Look up any model, term, or owner
```

## MCP Server

Included in this package via `context serve`.

```json
{
  "mcpServers": {
    "runcontext": {
      "command": "npx",
      "args": ["@runcontext/cli", "serve", "--stdio"]
    }
  }
}
```

8 MCP tools: search, explain, validate, tier, golden-queries, guardrails, list-products, get-product.

## Tiers

- **Bronze** — Scaffolded metadata from schema introspection
- **Silver** — Auto-enriched with descriptions, types, and relationships
- **Gold** — Agent-curated with verified business context, golden queries, and guardrails

## Documentation

[runcontext.dev](https://runcontext.dev) | [GitHub](https://github.com/Quiet-Victory-Labs/runcontext)

## License

MIT
