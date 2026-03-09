# create-contextkit

Scaffold a new [RunContext](https://github.com/RunContext/runcontext) project — one command to start building an AI-ready data product from your database.

## Usage

```bash
npx create-contextkit my-project
cd my-project
context setup
```

The setup wizard opens in your browser. Fill out a Context Brief (name, owner, sensitivity, database connection), and the pipeline builds your semantic plane automatically.

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
├── contextkit.config.yaml
└── package.json
```

## What happens next

1. **`context setup`** — Browser wizard guides you through the Context Brief
2. **Pipeline runs** — Introspect database → scaffold Bronze → enrich to Silver
3. **`context dev --studio`** — Visual editor to curate metadata to Gold tier
4. **`context serve`** — MCP server live, AI agents get full context

## Part of RunContext

See the [RunContext repository](https://github.com/RunContext/runcontext) for full documentation.

## License

MIT
