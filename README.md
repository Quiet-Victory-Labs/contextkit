<h1 align="center">RunContext</h1>

<p align="center">
  <strong>Turn your database into an AI-ready semantic plane.</strong>
</p>

<p align="center">
  <a href="https://github.com/Quiet-Victory-Labs/runcontext/actions/workflows/ci.yml"><img src="https://github.com/Quiet-Victory-Labs/runcontext/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@runcontext/cli"><img src="https://img.shields.io/npm/v/@runcontext/cli" alt="npm" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

<p align="center">
  Run <code>context setup</code>, connect your database, and RunContext introspects the schema to scaffold a semantic plane — structured metadata that tells AI agents what your data means, how to query it safely, and which business rules apply. Then hand off to your AI agent to curate it to Gold. Serve it via MCP to Claude Code, Cursor, Copilot, or any compatible tool.
</p>

---

## Quick Start

```bash
npx @runcontext/cli setup
```

A browser wizard opens. Connect your database, fill out the Context Brief, and RunContext scaffolds your semantic plane automatically.

---

## How It Works

The `context setup` wizard walks you through six steps:

| Step | What happens |
|------|-------------|
| **1. Connect** | Connect to your database |
| **2. Define** | Name your semantic plane, set owner and sensitivity |
| **3. Scaffold** | Auto-introspect schema and generate Bronze-tier metadata |
| **4. Checkpoint** | Review what was built |
| **5. Curate** | Hand off to your IDE's AI agent to curate metadata to Gold using real data queries |
| **6. Serve** | Start the MCP server and serve your semantic plane to AI tools |

The result is a `context/` directory of YAML files following the OSI (Open Semantic Interchange) specification.

---

## Tiers

**Bronze** -- Scaffolded automatically. Every model and field has a description, owner, and type. Your data is discoverable.

**Silver** -- Sample values, tags, and richer descriptions. AI agents can interpret the data with confidence.

**Gold** -- Golden queries, guardrails, semantic roles, and business rules. Agents generate correct SQL on the first try.

Check your progress with `context tier`.

---

## Commands

```bash
context setup                  # Browser wizard -- database to semantic plane
context tier [model]           # Bronze/Silver/Gold scorecard
context serve                  # Start MCP server (stdio for IDE integration)
context lint                   # Validate metadata
context fix                    # Auto-fix lint issues
context verify                 # Check metadata against live database
context build                  # Compile context layer to manifest
context dev                    # Watch mode
context introspect             # Schema introspection
context explain [term]         # Look up models, terms, or owners
```

---

## MCP Server

Add RunContext to your AI tool's MCP configuration:

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

**6 MCP tools available:**

| Tool | Description |
|------|-------------|
| `context_search` | Find models, datasets, and fields by keyword |
| `context_explain` | Get full model details |
| `context_validate` | Run the linter |
| `context_tier` | Get tier scorecard |
| `context_golden_query` | Find validated SQL queries |
| `context_guardrails` | Get WHERE clauses and access rules for tables |

Works with Claude Code, Cursor, Copilot, Windsurf, Claude Desktop, and any MCP-compatible tool.

---

## Database Support

| Database | Supported |
|----------|-----------|
| PostgreSQL | Yes |
| DuckDB | Yes |
| MySQL | Yes |
| SQL Server | Yes |
| SQLite | Yes |
| Snowflake | Yes |
| BigQuery | Yes |
| ClickHouse | Yes |
| Databricks | Yes |

---

## Packages

| Package | Description |
|---------|-------------|
| [`@runcontext/cli`](https://www.npmjs.com/package/@runcontext/cli) | CLI, setup wizard, and MCP server |
| [`@runcontext/core`](https://www.npmjs.com/package/@runcontext/core) | Compiler, linter, tier engine, adapters |
| [`@runcontext/mcp`](https://www.npmjs.com/package/@runcontext/mcp) | MCP protocol implementation |
| [`@runcontext/ui`](https://www.npmjs.com/package/@runcontext/ui) | Browser-based setup wizard and planes viewer |
| [`@runcontext/uxd`](https://www.npmjs.com/package/@runcontext/uxd) | Design system components |
| [`@runcontext/db`](https://www.npmjs.com/package/@runcontext/db) | Database utilities |
| [`create-runcontext`](https://www.npmjs.com/package/create-runcontext) | Project scaffolder (`npx create-runcontext`) |

---

## Links

- [Documentation](https://docs.runcontext.dev)
- [GitHub](https://github.com/Quiet-Victory-Labs/runcontext)
- [npm](https://www.npmjs.com/package/@runcontext/cli)

## License

MIT
