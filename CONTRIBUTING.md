# Contributing to RunContext

Thanks for your interest in contributing to RunContext! This guide will help you get set up and productive quickly.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/RunContext/runcontext.git
cd runcontext

# Install dependencies (requires pnpm)
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type-check the entire project
pnpm typecheck
```

## Monorepo Structure

```
packages/
  core/     — Parser, compiler, linter (40 rules), tier engine, fixer, schemas
  cli/      — CLI with 15 commands (lint, build, tier, explain, fix, dev, init, site, serve, validate-osi, etc.)
  mcp/      — MCP server for AI agent integration
  site/     — Static documentation site generator
create-runcontext/  — Project scaffolder (pnpm create runcontext)
```

All packages are published under `@runcontext/*` except the scaffolder (`create-runcontext`).

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @runcontext/core test

# Run tests in watch mode
pnpm test -- --watch

# Run a specific test file
pnpm test -- --run packages/core/src/linter/__tests__/bronze-rules.test.ts
```

## Adding a Lint Rule

Lint rules live in `packages/core/src/linter/rules/`. Each tier has its own file:

- `bronze.ts` and related — Basic discoverability (12 rules)
- `silver.ts` and related — Trusted metadata (3 rules)
- `gold.ts` and related — AI-ready completeness (14 rules)
- `data-*.ts` — Data accuracy rules (8 rules)
- `composite.ts` — Tier threshold rules (3 rules)

To add a new rule:

1. Add the rule function to the appropriate tier file
2. Register it in the `RULES` array in that file
3. Add tests in the corresponding `__tests__/` directory
4. Update the rule count in README.md if applicable

## Code Style

- **TypeScript strict mode** — all packages use `strict: true`
- **No `any` types** — use proper types or union types
- **ESM modules** — all packages use `"type": "module"`
- **Zod for validation** — all YAML schemas are defined with Zod

## Pull Requests

1. Fork the repository and create a branch from `main`
2. Make your changes with tests
3. Run `pnpm build && pnpm test && pnpm typecheck` to verify
4. Submit a pull request with a clear description of the change

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
