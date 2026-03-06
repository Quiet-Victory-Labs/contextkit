# @runcontext/core

Core engine for [ContextKit](https://github.com/erickittelson/ContextKit) — AI-ready metadata governance over OSI.

## What it does

- **Compiler** — Parses and validates OSI models, governance, rules, lineage, and glossary YAML files into a unified context graph
- **Linter** — 37 rules covering schema validation, naming, ownership, security, glossary, governance, lineage, data accuracy, and tier requirements
- **Tier Engine** — Scores metadata maturity as Bronze (Discoverable), Silver (Trusted), or Gold (AI-Ready)
- **Fixer** — Auto-fixes lint issues where possible (descriptions, grain, security, trust, refresh cadence, sample values)
- **Introspector** — Scans DuckDB or PostgreSQL databases and scaffolds Bronze-level OSI metadata
- **Enricher** — Suggests and applies metadata enrichments to promote toward Silver or Gold tier
- **Schema Validation** — Validates OSI files against the bundled JSON schema

## Installation

```bash
npm install @runcontext/core
```

## Usage

```typescript
import { compile, lint, tierScore, introspect, enrich } from '@runcontext/core';

// Compile context files into a manifest
const manifest = await compile({ contextDir: './context' });

// Lint for issues
const diagnostics = await lint({ contextDir: './context' });

// Score tier maturity
const score = tierScore(manifest, 'my-model');
// → { tier: 'GOLD', bronze: { pass: true, ... }, ... }
```

## Part of ContextKit

This is the core library. For the full toolkit, see [@runcontext/cli](https://www.npmjs.com/package/@runcontext/cli) or the [ContextKit repository](https://github.com/erickittelson/ContextKit).

## License

MIT
