<h1 align="center">ContextKit</h1>

<p align="center">
  <strong>Build AI-ready semantic planes from your data</strong>
</p>

<p align="center">
  ContextKit turns your database into a semantic plane — a structured layer of metadata that AI agents can read, trust, and act on. Introspect your schema, curate meaning, and serve context to any AI tool via MCP. No more guessing. No more hallucinated SQL.
</p>

<p align="center">
  <a href="https://github.com/erickittelson/ContextKit/actions/workflows/ci.yml"><img src="https://github.com/erickittelson/ContextKit/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@runcontext/cli"><img src="https://img.shields.io/npm/v/@runcontext/cli" alt="npm" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://github.com/open-semantic-interchange/OSI"><img src="https://img.shields.io/badge/OSI-Open_Semantic_Interchange-c9a55a" alt="OSI" /></a>
</p>

---

### Works with

`Claude Code` · `Cursor` · `Copilot` · `Windsurf` · `Codex` — any MCP-compatible AI tool.

---

## Quickstart

```bash
npx create-contextkit my-data
cd my-data
context setup
# Fill out the Context Brief in your browser
# AI curates your semantic plane automatically
```

---

## What is a Semantic Plane?

A semantic plane is a structured metadata layer that sits between your database and AI agents. It captures what your data means — field descriptions, business rules, metric definitions, safe joins, guardrail filters — so agents generate correct queries instead of guessing. Think of it as the instruction manual your data never had.

---

## The Tiers

**Bronze — Discoverable.** Every model, field, and dataset has a description, an owner, and a security classification. The minimum for catalog entry.

**Silver — Trusted.** Adds trust status, glossary links, lineage, sample values, and refresh cadence. Bridges raw tables to business concepts. `context enrich` gets you here automatically.

**Gold — AI-Ready.** Semantic roles, aggregation rules, guardrail filters, golden queries, business rules, and explicit relationships. This is what makes agents generate correct SQL. It requires human curation — and that's where the real value is.

---

## Local-first, Cloud-ready

ContextKit runs entirely on your machine. Bring your own MCP server, connect any database, curate metadata locally — free and open source.

Need collaboration, hosted MCP, or team workflows? **RunContext Cloud** adds multi-user curation, hosted serving, and managed infrastructure on top of the same open core.

---

## Open Semantic Interchange

ContextKit metadata follows the [Open Semantic Interchange (OSI)](https://github.com/open-semantic-interchange/OSI) specification — a vendor-neutral format for describing data products. Export your semantic plane as portable YAML. Import it into any OSI-compliant tool. No lock-in.

---

## Packages

| Package | Description |
|---|---|
| [`@runcontext/core`](https://www.npmjs.com/package/@runcontext/core) | Compiler, linter, and tier engine |
| [`@runcontext/cli`](https://www.npmjs.com/package/@runcontext/cli) | CLI — setup, introspect, enrich, build, serve |
| [`@runcontext/mcp`](https://www.npmjs.com/package/@runcontext/mcp) | MCP server for AI agents |
| [`@runcontext/site`](https://www.npmjs.com/package/@runcontext/site) | Documentation site generator |
| [`@runcontext/ui`](https://www.npmjs.com/package/@runcontext/ui) | Onboarding and studio UI |
| [`create-contextkit`](https://www.npmjs.com/package/create-contextkit) | Project scaffolder |

---

## Links

- [Documentation](https://contextkit.dev)
- [npm](https://www.npmjs.com/package/@runcontext/cli)
- [RunContext Cloud](https://runcontext.io)

## License

MIT
