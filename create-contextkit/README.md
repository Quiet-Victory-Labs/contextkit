# create-contextkit

Scaffold a new [ContextKit](https://github.com/Quiet-Victory-Labs/contextkit) project — AI-ready semantic metadata for your database in one command.

## Usage

```bash
# Create a new ContextKit project
npx create-contextkit my-project
cd my-project

# Start working
context lint
context tier
context build
```

## What it creates

```
my-project/
├── context/
│   ├── models/          # OSI semantic models
│   ├── governance/      # Ownership, trust, security, semantic roles
│   ├── rules/           # Golden queries, business rules, guardrails
│   ├── lineage/         # Upstream/downstream lineage
│   ├── glossary/        # Business term definitions
│   └── owners/          # Team ownership records
├── contextkit.config.yaml
└── package.json
```

Includes example files to get started. Run `context setup` after scaffolding to connect a database and auto-generate metadata.

## Part of ContextKit

See the [ContextKit repository](https://github.com/Quiet-Victory-Labs/contextkit) for full documentation.

## License

MIT
