# @runcontext/mcp

The MCP (Model Context Protocol) implementation for [RunContext](https://github.com/Quiet-Victory-Labs/runcontext). Exposes semantic plane metadata to AI agents over stdio or HTTP.

> **This package is included in [`@runcontext/cli`](https://www.npmjs.com/package/@runcontext/cli)** via `context serve`. Most users do not need to install it separately.

## Usage via CLI

```bash
npm install @runcontext/cli
context serve --stdio
```

Or in your MCP client config:

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

During the **Curate** step of the setup wizard, your AI agent (Claude Code, Cursor, Copilot) uses these MCP tools to query the database and write Gold-quality metadata.

## Documentation

[runcontext.dev](https://runcontext.dev) | [GitHub](https://github.com/Quiet-Victory-Labs/runcontext)

## License

MIT
