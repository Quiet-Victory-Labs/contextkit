# @runcontext/mcp

MCP server for [ContextKit](https://github.com/erickittelson/ContextKit) — expose AI-ready metadata to agents via the [Model Context Protocol](https://modelcontextprotocol.io).

## What it does

Serves your ContextKit metadata graph — models, governance, glossary, golden queries, guardrails, business rules — to AI agents over MCP. Agents get structured semantic context instead of guessing from raw schemas.

## Usage

Usually accessed through the CLI:

```bash
# stdio transport (for Claude Code, Cursor, etc.)
npx @runcontext/cli serve --stdio

# HTTP transport (for multi-agent or remote setups)
npx @runcontext/cli serve --http --port 3000
```

## Resources

| Resource | Description |
|---|---|
| `context://manifest` | Full compiled manifest with all models, governance, and rules |
| `context://model/{name}` | Single model with datasets, fields, relationships, metrics |
| `context://glossary` | All business term definitions and synonyms |
| `context://tier/{name}` | Tier scorecard for a model |

## Tools

| Tool | Description |
|---|---|
| `context_search` | Full-text search across models, fields, terms, and owners |
| `context_explain` | Look up any entity by name and get full details |
| `context_validate` | Run lint rules and return diagnostics |
| `context_tier` | Get the current tier scorecard |
| `context_golden_queries` | Retrieve curated SQL templates for a model |
| `context_guardrails` | Get required filters and business rules for safe queries |

## Configure in Claude Code

`.claude/mcp.json`:

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

Or HTTP mode:

```json
{
  "mcpServers": {
    "contextkit": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Part of ContextKit

See the [ContextKit repository](https://github.com/erickittelson/ContextKit) for full documentation.

## License

MIT
