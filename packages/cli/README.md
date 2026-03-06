# @runcontext/cli

CLI for [ContextKit](https://github.com/erickittelson/ContextKit) — AI-ready metadata governance over OSI.

**Your data already has a schema. ContextKit gives it meaning.**

## Installation

```bash
# Global install
npm install -g @runcontext/cli

# Or per-project
npm install -D @runcontext/cli
```

## Quick Start

```bash
# Point at any database — interactive wizard does the rest
context setup

# Or step by step
context introspect --db duckdb://warehouse.duckdb
context enrich --target silver --apply
context tier
```

## Commands

### Core Workflow

```bash
context setup                    # Interactive wizard — database to metadata in one flow
context introspect               # Scan a database → scaffold Bronze-level OSI metadata
context enrich --target silver   # Auto-enrich metadata toward a target tier
context lint                     # Run 37 lint rules against context files
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

## The Tier System

| Tier | What it means | How to get there |
|---|---|---|
| **Bronze** | Discoverable — described, owned, classified | `context introspect` |
| **Silver** | Trusted — lineage, glossary, sample values, trust status | `context enrich --target silver` |
| **Gold** | AI-Ready — semantic roles, golden queries, guardrails, business rules | Human curation + `context enrich --target gold` |

## Database Support

| Adapter | Connection |
|---|---|
| DuckDB | `--db duckdb://path.duckdb` |
| PostgreSQL | `--db postgres://user:pass@host:5432/db` |
| MySQL | `--db mysql://user:pass@host:3306/db` |
| SQL Server | `--db mssql://user:pass@host:1433/db` |
| SQLite | `--db path/to/file.sqlite` |
| Snowflake | `--db snowflake://account/database/schema` |
| BigQuery | `--db bigquery://project/dataset` |
| ClickHouse | `--db clickhouse://host:8123` |
| Databricks | Config file only |

Each adapter requires its own driver as an optional peer dependency. See [Database Support docs](https://contextkit.dev/reference/databases/) for installation details.

## MCP Server

Expose your metadata to AI agents:

```bash
# For Claude Code / Cursor
context serve --stdio

# For multi-agent setups
context serve --http --port 3000
```

Add to `.claude/mcp.json`:

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

## Full Documentation

See the [ContextKit repository](https://github.com/erickittelson/ContextKit) for complete docs, file structure, tier requirements, and examples.

## License

MIT
