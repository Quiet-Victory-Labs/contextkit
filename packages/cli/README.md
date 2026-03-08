# @runcontext/cli

**ContextKit — tell your AI agent to build your semantic layer.**

Tell your AI agent: *"Install @runcontext/cli and build a semantic layer for my database."*

The agent introspects your database, scaffolds metadata, and goes back and forth with you — asking about metrics, ownership, and business rules — while it builds the semantic layer using CLI commands. When it reaches Gold tier, it exports an **AI Blueprint** and serves the metadata to other AI agents via MCP.

Works with Claude Code, Cursor, Copilot, Windsurf, Codex, and any MCP-compatible AI tool. Supports PostgreSQL, DuckDB, MySQL, SQL Server, SQLite, Snowflake, BigQuery, ClickHouse, and Databricks.

## Installation

```bash
npm install @runcontext/cli
```

## Quick Start

In Claude Code, Cursor, Windsurf, or any agentic coding platform:

> *"Install @runcontext/cli and build a semantic layer for my database."*

Or run it yourself:

```bash
context setup           # Interactive wizard — database to metadata in one flow
context tier            # Check Bronze/Silver/Gold score
context blueprint       # Export AI Blueprint (portable Gold-tier spec)
context serve --stdio   # Serve to AI agents via MCP
```

## Commands

```bash
# Build the semantic layer
context setup                    # Interactive wizard — full pipeline in one flow
context new <name>               # Scaffold a new data product
context introspect               # Scan a database -> scaffold Bronze metadata
context enrich --target silver   # Auto-enrich toward a target tier
context lint                     # Run 40 lint rules
context fix --write              # Auto-fix lint issues
context build                    # Compile -> emit manifest JSON
context tier [model]             # Show Bronze/Silver/Gold scorecard

# Explore and verify
context explain <name>           # Look up any model, term, or owner
context rules                    # List all lint rules
context validate-osi <file>      # Validate against OSI spec
context verify                   # Check accuracy against a live database

# Export and serve
context blueprint [model]        # Export AI Blueprints (portable OSI YAML)
context serve --stdio            # MCP server over stdio
context serve --http --port 3000 # MCP server over HTTP
context site                     # Static documentation site
context dev --studio             # Visual editor in the browser
context init                     # Scaffold a new project
```

## Database Support

DuckDB, PostgreSQL, MySQL, SQL Server, SQLite, Snowflake, BigQuery, ClickHouse, Databricks.

## MCP Server

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

## Documentation

[contextkit.dev](https://contextkit.dev) | [GitHub](https://github.com/Quiet-Victory-Labs/contextkit)

## License

MIT
