# @runcontext/cli

**Turn your database into an AI-ready data product.**

Run `context setup` and a guided wizard opens in your browser. Fill out a Context Brief — name your data product, set an owner, choose sensitivity, connect your database. RunContext introspects the schema, scaffolds metadata, and auto-enriches toward Silver tier. Open the visual studio to curate to Gold. Serve the semantic plane to AI agents via MCP.

Works with Claude Code, Cursor, Copilot, Windsurf, Codex, and any MCP-compatible AI tool. Supports PostgreSQL, DuckDB, MySQL, SQL Server, SQLite, Snowflake, BigQuery, ClickHouse, and Databricks.

## Installation

```bash
npm install @runcontext/cli
```

## Quick Start

```bash
context setup
# → Browser wizard opens
# → Fill out Context Brief (name, owner, sensitivity, database)
# → Pipeline runs: introspect → scaffold → enrich → verify
# → Your semantic plane is ready
```

Or tell your AI agent:

> *"Install @runcontext/cli and build a semantic layer for my database."*

## Commands

```bash
# Guided setup
context setup                    # 5-step browser wizard — database to data product
context dev --studio             # Visual editor — curate metadata, see tier updates live

# Build pipeline
context new <name>               # Scaffold a new data product manually
context introspect --db <url>    # Connect database, scaffold Bronze metadata
context enrich --target silver   # Auto-enrich toward Silver tier
context build                    # Compile semantic plane → manifest JSON
context tier [model]             # Show Bronze/Silver/Gold scorecard

# Quality
context lint                     # Run 40 lint rules
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

## Documentation

[runcontext.dev](https://runcontext.dev) | [GitHub](https://github.com/RunContext/runcontext)

## License

MIT
