# @runcontext/core

The engine package behind [RunContext](https://github.com/Quiet-Victory-Labs/runcontext). Provides the compiler, linter, tier engine (Bronze/Silver/Gold), database adapters, and OSI schema validation that power the CLI and MCP server.

> **Most users should install [`@runcontext/cli`](https://www.npmjs.com/package/@runcontext/cli)** instead of using this package directly. The CLI wraps core with the setup wizard, build pipeline, and MCP server.

## What it provides

- **Compiler** — Resolves and compiles semantic plane YAML into a manifest
- **Linter** — Validates metadata against lint rules
- **Tier engine** — Scores metadata as Bronze, Silver, or Gold
- **Database adapters** — PostgreSQL, DuckDB, MySQL, SQL Server, SQLite, Snowflake, BigQuery, ClickHouse, Databricks
- **OSI schema validation** — Validates semantic plane files against the OSI spec

## Installation

```bash
npm install @runcontext/core
```

## Documentation

[runcontext.dev](https://runcontext.dev) | [GitHub](https://github.com/Quiet-Victory-Labs/runcontext)

## License

MIT
