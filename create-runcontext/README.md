# create-runcontext

Scaffold a new [RunContext](https://github.com/Quiet-Victory-Labs/runcontext) project — one command to start building an AI-ready semantic plane from your database.

## Usage

```bash
npx create-runcontext my-project
cd my-project
context setup
```

The 6-step setup wizard walks you through: Connect > Define > Scaffold > Checkpoint > Curate > Serve.

## What it creates

```
my-project/
├── context/
│   ├── models/          # Semantic models (OSI YAML)
│   ├── governance/      # Ownership, trust, security, semantic roles
│   ├── rules/           # Golden queries, business rules, guardrails
│   ├── lineage/         # Upstream/downstream lineage
│   ├── glossary/        # Business term definitions
│   └── owners/          # Team ownership records
├── runcontext.config.yaml
└── package.json
```

## What happens next

1. **`context setup`** — 6-step wizard guides you from database to semantic plane
2. **Scaffold & Checkpoint** — Introspect database, scaffold Bronze metadata, lock baseline
3. **Curate** — Your AI agent (Claude Code, Cursor, Copilot) uses MCP to query the database and write Gold-quality metadata
4. **`context serve`** — MCP server goes live, AI agents get full context

## Part of RunContext

See the [RunContext repository](https://github.com/Quiet-Victory-Labs/runcontext) for full documentation.

## License

MIT
