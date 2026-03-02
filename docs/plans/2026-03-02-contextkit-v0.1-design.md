# ContextKit v0.1 Design Document

**Date**: 2026-03-02
**Status**: Approved

## Overview

ContextKit is an open-source framework that lets teams define, lint, autofix, compile, and publish institutional context (concepts, definitions, policies, ownership, examples) as code. It produces a portable Context Manifest for agents/tools and a static Context Site for humans.

The framing: **"ESLint + Prettier + Terraform, but for institutional meaning."**

## Scope

Full v0.1: init, dev, lint, fix, build, site build, serve --mcp, explain.

## Tooling Decisions

| Area | Choice |
|---|---|
| Language | TypeScript (Node.js) |
| Package manager | pnpm (workspaces) |
| Build tool | tsup (esbuild-based) |
| CLI framework | Commander.js |
| Schema validation | Zod |
| Test runner | Vitest |
| Site templates | EJS |
| Site styling | Tailwind CSS |
| Client search | MiniSearch |
| MCP SDK | @modelcontextprotocol/sdk |
| File watching | chokidar |

## Monorepo Structure

```
contextkit/
├── packages/
│   ├── core/              # @contextkit/core
│   │   ├── src/
│   │   │   ├── config/    # Config loading (TS + YAML)
│   │   │   ├── parser/    # YAML/TS file parser
│   │   │   ├── schema/    # Zod schemas for all node types
│   │   │   ├── graph/     # ContextGraph IR + indexes
│   │   │   ├── compiler/  # Pipeline orchestrator
│   │   │   ├── linter/    # Rule engine + built-in rules
│   │   │   ├── fixer/     # Autofix transforms
│   │   │   └── types/     # Shared TypeScript types
│   │   └── package.json
│   ├── cli/               # @contextkit/cli
│   │   ├── src/
│   │   │   ├── commands/  # init, dev, lint, fix, build, serve, explain
│   │   │   ├── formatters/ # pretty, json output formatters
│   │   │   └── index.ts   # Commander.js entry point
│   │   └── package.json
│   ├── site/              # @contextkit/site
│   │   ├── src/
│   │   │   ├── templates/ # EJS HTML templates
│   │   │   ├── assets/    # Tailwind CSS, client-side JS
│   │   │   ├── search/    # MiniSearch index builder
│   │   │   └── generator.ts
│   │   └── package.json
│   └── mcp/               # @contextkit/mcp
│       ├── src/
│       │   ├── server.ts  # MCP server setup
│       │   ├── resources/ # Resource handlers
│       │   └── tools/     # Tool handlers
│       └── package.json
├── create-contextkit/     # npm create contextkit scaffolder
├── fixtures/              # Test fixtures
│   ├── minimal/
│   ├── errors/
│   └── full/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.workspace.ts
└── package.json
```

### Package boundaries

- `core` — zero CLI/UI dependencies, pure library
- `cli` — depends on core, site, mcp
- `site` — depends on core
- `mcp` — depends on core + @modelcontextprotocol/sdk
- `create-contextkit` — standalone (templates only)

## Compiler Pipeline

Multi-phase pipeline with typed intermediate representation:

```
1. Discover    → Glob context/**/*.{ctx.yaml,policy.yaml,md}
2. Parse       → YAML.parse / TS import → raw objects
3. Validate    → Zod schemas → typed nodes
4. Normalize   → Kebab-case IDs, tag normalization, owner ref resolution
5. Resolve     → Build ContextGraph: nodes + edges + indexes
6. Lint        → Run rules against resolved graph → Diagnostic[]
7. Emit        → Write context.manifest.json (+ schema)
```

Each phase takes immutable input and produces immutable output.

## Internal Data Model

### Node types

```typescript
type NodeKind = "concept" | "entity" | "policy" | "term" | "owner" | "product";

interface BaseNode {
  id: string;              // kebab-case stable ID
  kind: NodeKind;
  source: SourceLocation;  // file + line/col
  owner?: string;          // ref to owner ID
  tags?: string[];
  status?: "draft" | "certified" | "deprecated";
}
```

Specialized interfaces for each kind: Concept, Entity, Policy, Product, Term, Owner.

### ContextGraph

```typescript
interface ContextGraph {
  nodes: Map<string, BaseNode>;
  edges: Edge[];
  indexes: {
    byKind: Map<NodeKind, string[]>;
    byOwner: Map<string, string[]>;
    byTag: Map<string, string[]>;
    byStatus: Map<string, string[]>;
    dependents: Map<string, string[]>;
  };
}
```

### Diagnostics

```typescript
interface Diagnostic {
  ruleId: string;
  severity: "error" | "warning";
  message: string;
  source: SourceLocation;
  fixable: boolean;
  fix?: Fix;
  suggestions?: string[];
}

interface Fix {
  description: string;
  edits: TextEdit[];  // { file, range, newText }
}
```

## Linter

### Rule interface

```typescript
interface LintRule {
  id: string;
  defaultSeverity: Severity;
  description: string;
  fixable: boolean;
  run(graph: ContextGraph): Diagnostic[];
}
```

### v0.1 rules (12)

| Rule ID | Default | Fixable |
|---|---|---|
| `schema/valid-yaml` | error | no |
| `naming/id-kebab-case` | error | yes |
| `ownership/required` | error | yes (stub) |
| `descriptions/required` | warning | yes (stub) |
| `references/resolvable` | error | no |
| `glossary/no-duplicate-terms` | warning | partial |
| `concepts/certified-requires-evidence` | error | no |
| `policies/unknown-subject` | error | no |
| `policies/deny-overrides-allow` | error | yes |
| `docs/examples-required` | warning | yes (stub) |
| `deprecation/require-sunset` | warning | yes |
| `packaging/no-secrets` | error | partial |

### Autofix engine

Lint phase produces diagnostics with fix descriptors. The fixer applies text edits against source YAML. `--write` applies changes, default is dry-run.

## CLI Commands

```
context init [--template minimal|team|enterprise]
context dev                     # Watch mode
context lint [--format pretty|json] [--max-warnings N] [--quiet]
context fix [--write] [--unsafe]
context build [--strict]
context site build
context serve [--mcp] [--http PORT] [--stdio]
context explain <id> [--json]
```

### Exit codes

- `0` — success
- `1` — errors found or build failure
- `2` — invalid config or usage error

### `context dev`

- chokidar watches `context/**`
- Debounce: 100ms
- On change: re-run full pipeline, print summary

## Site Generator

### Output structure

```
dist/site/
├── index.html
├── concepts/{id}.html
├── products/{id}.html
├── policies/{id}.html
├── owners/{id}.html
├── glossary/index.html
├── search.html
└── assets/
    ├── style.css
    ├── search-index.json
    └── search.js
```

### Detail pages include

- Definition/description
- Owner (linked)
- Status badge
- Tags
- Dependencies + backlinks
- Applicable policies
- Examples (do / don't)
- Evidence citations

### Tech

- EJS templates rendered to static HTML
- Tailwind CSS compiled at build time
- MiniSearch pre-built index for client-side search
- No JS framework — vanilla JS only

## MCP Server

### Resources

| URI | Returns |
|---|---|
| `context://manifest` | Full manifest JSON |
| `context://concept/{id}` | Resolved concept |
| `context://product/{id}` | Product with concepts |
| `context://policy/{id}` | Policy with selectors |
| `context://glossary` | All terms |

### Tools

| Tool | Input | Output |
|---|---|---|
| `context_search` | `{ query, kinds?, tags? }` | Matching nodes |
| `context_explain` | `{ id }` | Full node + deps + policies |
| `context_validate` | `{}` | Diagnostics array |

### Transports

- **stdio** (default) — local agent integrations
- **HTTP** (Streamable HTTP) — network access, configurable port/host

### Security

- Read-only (no write tools in v0)
- No secrets in schemas or payloads
- Manifest is sole data source

## Config

### contextkit.config.ts

```typescript
import type { ContextKitConfig } from "@contextkit/core";

const config: ContextKitConfig = {
  project: {
    id: "acme-context",
    displayName: "Acme Institutional Context",
    version: "0.1.0",
  },
  paths: {
    rootDir: ".",
    contextDir: "./context",
    distDir: "./dist",
    cacheDir: "./.contextkit-cache",
  },
  site: {
    enabled: true,
    title: "Acme Context",
    basePath: "/",
  },
  lint: {
    defaultSeverity: "warning",
    rules: {
      "ownership/required": "error",
      "references/resolvable": "error",
      "concepts/certified-requires-evidence": "error",
    },
  },
  mcp: {
    enabled: true,
    transport: ["stdio", "http"],
    http: { port: 7331, host: "127.0.0.1" },
  },
  plugins: [],
};

export default config;
```

YAML alternative (`contextkit.config.yaml`) also supported.

## Manifest Output

`dist/context.manifest.json`:

- `schemaVersion: "contextkit.manifest.v0"`
- Flat arrays: products, concepts, policies, terms, owners
- `indexes.byId` for lookup
- Build metadata (timestamp, git commit, dirty flag)
- Validated by `dist/context.manifest.schema.json` (JSON Schema)

## Testing Strategy

| Layer | What |
|---|---|
| Unit | Each compiler phase, each lint rule, fix transforms, config loading |
| Integration | Full pipeline: fixture repo → build → verify manifest |
| Golden (snapshots) | Lint output formatting, manifest output, site pages |
| CLI | Subprocess tests via execa |

### Fixtures

- `fixtures/minimal/` — happy path (2 concepts, 1 policy, 1 owner)
- `fixtures/errors/` — files with known lint violations
- `fixtures/full/` — comprehensive example matching the spec

## Performance Targets

- `context build` for 1,000 nodes: < 2s
- `context dev` incremental rebuild: < 300ms
