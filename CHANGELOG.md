# Changelog

All notable changes to this project will be documented in this file.

## [0.4.1] - 2026-03-06

### Fixed

- Improved CLI help discoverability — all 9 supported databases now listed in `context setup` and `context introspect` help output
- Added MCP setup guide to AGENT_INSTRUCTIONS.md
- Use explicit `@runcontext/cli` in all agent-facing prompts

## [0.4.0] - 2026-03-05

### Added

- **`context new` command** for scaffolding data products
- **AI Blueprint branding** for `context blueprint` command
- New documentation pages and data products concept
- 16 CLI commands total

### Changed

- `context blueprint` renamed with AI Blueprint branding

## [0.2.0] - 2026-03-02

### Added

- **OSI v1.0 native support** — semantic models with datasets, fields, metrics, and relationships
- **Governance companion files** — ownership, trust level, security classification, grain, and field-level semantic roles
- **Business rules** — golden queries, business rules, guardrail filters, and drill-down hierarchies
- **Lineage declarations** — upstream sources and downstream consumers with type and refresh metadata
- **Glossary terms** — definitions, synonyms, and cross-references
- **Owner records** — team-level ownership with contact and description
- **Bronze / Silver / Gold tier engine** — 25 lint rules compute metadata maturity automatically
- **MCP server** — 4 resources and 6 tools for exposing context to AI agents via the Model Context Protocol
- **Static site generator** — browsable documentation with tier badges, schema browser, and full-text search
- **Project scaffolder** — `pnpm create contextkit my-project` for instant project setup
- **10 CLI commands** — `lint`, `build`, `tier`, `explain`, `fix`, `dev`, `init`, `site`, `serve`, `validate-osi`
- **Auto-fixer** — `context fix --write` applies safe fixes for common lint issues

### Changed

- Complete architecture rewrite from v0.1
- Package scope: `@runcontext/*`
- Lint rules expanded from 12 to 25 across three tiers

## [0.1.1] - 2026-03-02

### Fixed

- Package metadata and publishing configuration

## [0.1.0] - 2026-03-02

### Added

- Initial release with basic YAML parsing, linting, and CLI
