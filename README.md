# ContextKit

[![CI](https://github.com/erickittelson/ContextKit/actions/workflows/ci.yml/badge.svg)](https://github.com/erickittelson/ContextKit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@runcontext/core)](https://www.npmjs.com/package/@runcontext/core)

AI-ready metadata governance toolkit built on [OSI v1.0](https://github.com/Open-Model-Initiative/OMI). Define governance, lineage, glossary, and query rules alongside your semantic models -- then lint, tier, explain, and expose them to AI agents via MCP.

## Key Features

- **OSI-native** -- models use the Open Semantic Interface specification
- **Bronze / Silver / Gold tiers** -- automated maturity scoring for every model
- **25 lint rules** -- covering schema validation, naming, ownership, descriptions, references, security, glossary, governance, lineage, query rules, and tier requirements
- **MCP server** -- expose your full context graph to AI agents via the Model Context Protocol
- **Static site generator** -- build browsable documentation from your context files
- **Scaffolder** -- `pnpm create contextkit my-project` to get started

## Installation

```bash
# Scaffold a new project
pnpm create contextkit my-project

# Or add to an existing project
npm install -D @runcontext/cli
```

## Quick Start

```bash
# Scaffold a new project
pnpm create contextkit my-project
cd my-project

# Lint, build, and explore
npx context lint
npx context build
npx context tier
npx context explain retail-sales
```

## Packages

| Package | Description |
|---------|-------------|
| `@runcontext/core` | Parser, compiler, linter (25 rules), tier engine, fixer, schema validation |
| `@runcontext/cli` | CLI with 10 commands (see below) |
| `@runcontext/mcp` | MCP server -- resources, tools, and prompts for AI agents |
| `@runcontext/site` | Static documentation site generator |
| `create-contextkit` | Project scaffolder |

## CLI Commands

```bash
npx context lint              # Lint all context files
npx context build             # Compile and emit manifest JSON
npx context tier [model]      # Show Bronze/Silver/Gold scorecard
npx context explain <name>    # Look up a model, term, or owner
npx context fix --write       # Auto-fix lint issues
npx context dev               # Watch mode -- re-lint on changes
npx context init              # Scaffold a new project structure
npx context site              # Generate a static docs site
npx context serve --stdio     # Start the MCP server
npx context validate-osi <f>  # Validate a single OSI file
```

## File Structure

ContextKit projects use a set of YAML file types organized by convention:

```
context/
  models/
    retail-sales.osi.yaml           # OSI semantic model (datasets, fields, metrics)
  governance/
    retail-sales.governance.yaml    # Owner, trust, security, field-level governance
  rules/
    retail-sales.rules.yaml         # Golden queries, business rules, guardrails, hierarchies
  lineage/
    retail-sales.lineage.yaml       # Upstream/downstream lineage
  glossary/
    revenue.term.yaml               # Glossary terms and synonyms
  owners/
    analytics-team.owner.yaml       # Team ownership records
  contextkit.config.yaml            # Project configuration
```

## MCP Server

Expose your context graph to AI agents:

```bash
npx context serve --stdio
```

**Resources:** `context://manifest`, `context://model/{name}`, `context://glossary`, `context://tier/{name}`

**Tools:** `context_search`, `context_explain`, `context_validate`, `context_tier`, `context_golden_queries`, `context_guardrails`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
