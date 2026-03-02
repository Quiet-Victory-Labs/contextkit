# ContextKit

Git-native compiler, linter, and MCP server for institutional context.

ContextKit lets you define your organization's concepts, data products, policies, ownership, and glossary as YAML files in your repo. It compiles them into a typed manifest, lints for quality, generates documentation sites, and exposes everything to AI agents via MCP.

## Quick Start

```bash
# Scaffold a new project
pnpm create contextkit my-context
cd my-context

# Install the CLI
pnpm add -D @contextkit/cli

# Edit your context files in context/
# Then lint, build, and explore:
npx context lint
npx context build
npx context explain example-concept
```

## Packages

| Package | Description |
|---------|-------------|
| `@contextkit/core` | Compiler, linter, type system, and fixer |
| `@contextkit/cli` | CLI with lint, build, fix, dev, site, serve, explain commands |
| `@contextkit/site` | Static documentation site generator |
| `@contextkit/mcp` | MCP server for AI agent access |
| `create-contextkit` | Project scaffolder (`pnpm create contextkit`) |

## Context Files

Define your institutional knowledge as YAML in a `context/` directory:

```
context/
  concepts/       # Business concepts and definitions
  products/       # Data products
  policies/       # Access and governance policies
  entities/       # Data entities and schemas
  terms/          # Glossary terms
  owners/         # Team ownership
```

Example concept (`context/concepts/gross-revenue.ctx.yaml`):

```yaml
id: gross-revenue
definition: Total invoiced revenue before refunds or adjustments.
owner: finance-team
status: certified
certified: true
tags: [finance, metric]
evidence:
  - type: decision
    ref: "context://evidence/decisions/2026-03-revenue"
examples:
  - label: Correct usage
    content: "SUM(invoice_amount)"
    kind: do
```

## CLI Commands

```bash
npx context init              # Initialize a new project
npx context lint              # Lint context files
npx context build             # Compile manifest
npx context fix --write       # Auto-fix lint issues
npx context dev               # Watch mode
npx context explain <id>      # Look up a concept
npx context site build        # Generate docs site
npx context serve --stdio     # Start MCP server
```

## MCP Server

Expose your context to AI agents via the Model Context Protocol:

```bash
npx context serve --stdio
```

**Resources:** `context://manifest`, `context://concept/{id}`, `context://product/{id}`, `context://policy/{id}`, `context://glossary`

**Tools:** `context_search`, `context_explain`, `context_validate`

## Lint Rules

ContextKit includes 12 built-in lint rules:

- `schema/valid-yaml` — YAML schema validation
- `naming/id-kebab-case` — IDs must be kebab-case
- `ownership/required` — Concepts, products, entities need owners
- `descriptions/required` — All nodes need descriptions
- `references/resolvable` — All references must resolve
- `glossary/no-duplicate-terms` — No duplicate term definitions
- `concepts/certified-requires-evidence` — Certified concepts need evidence
- `policies/unknown-subject` — Policy selectors must reference known items
- `policies/deny-overrides-allow` — Deny rules need higher priority
- `docs/examples-required` — Certified concepts need examples
- `deprecation/require-sunset` — Deprecated nodes need sunset dates
- `packaging/no-secrets` — No secrets in context files

## License

MIT
