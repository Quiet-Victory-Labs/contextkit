# Context Studio — Interactive Metadata Editor

**Date:** 2026-03-06
**Status:** Approved

## Summary

Add a `--studio` flag to `context dev` that serves an interactive web UI for editing semantic layer metadata in the browser. Edits save back to YAML files on disk, which are then served to AI agents via `context serve` (MCP). The goal is to let both engineers and non-technical business users curate metadata from Bronze to Gold tier without touching YAML directly.

## Architecture

```
context dev --studio --port 4040
         │
         ├── HTTP Server (Node built-in http module)
         │     ├── GET /              → Generated HTML pages (with edit affordances)
         │     ├── GET /api/manifest  → Compiled manifest as JSON
         │     ├── POST /api/preview  → YAML diff for proposed changes (no write)
         │     ├── POST /api/save     → Write changes to YAML files on disk
         │     └── GET /api/events    → SSE stream (re-lint results, tier updates)
         │
         ├── File Watcher (chokidar, already in dev.ts)
         │     └── On YAML change → recompile → re-lint → push via SSE
         │
         └── Browser
               ├── Existing site pages with edit affordances injected
               ├── Inline editing, dropdowns, add/remove cards
               ├── Staged changes bar + Save modal with YAML diff preview
               └── Live tier scorecard updated via SSE
```

The `@runcontext/site` generator gains a `studioMode` boolean. When true, templates render edit buttons, form controls, the staged-changes bar, save modal, and SSE client script. When false, output is the same static site as today.

## Users

- **Data engineers / analytics engineers** — faster curation than editing YAML. See the full picture: schema, governance, rules, lineage.
- **Data stewards / business analysts** — describe fields, set business context, define golden queries through a visual interface. No YAML knowledge required.

## What's Editable

Everything needed to reach Gold tier:

### OSI Model (`context/models/*.osi.yaml`)
- Model description, ai_context
- Dataset descriptions
- Field descriptions
- Relationships (from/to/columns)
- Metrics (name/expression/description)

### Governance (`context/governance/*.governance.yaml`)
- Trust status (dropdown: draft/reviewed/endorsed/certified)
- Tags (multi-input)
- Refresh cadence, security classification
- Per-field: semantic_role (dropdown), default_aggregation (dropdown), additive (toggle), sample_values, business_context

### Rules (`context/rules/*.rules.yaml`)
- Golden queries (question + SQL + description)
- Business rules, guardrails (filter + reason), hierarchies

### Glossary (`context/glossary/*.term.yaml`)
- Term definition, synonyms, tags, owner

### Lineage (`context/lineage/*.lineage.yaml`)
- Upstream sources (source + type + notes)
- Downstream targets (target + type + notes)

### Owners (`context/owners/*.owner.yaml`)
- Display name, email, team

## UX Flow

### Editing Patterns
1. **Inline text edit** — Pencil icon → field becomes editable → changes staged locally
2. **Dropdown select** — For constrained values (semantic_role, trust, aggregation)
3. **Add/remove cards** — For lists (golden queries, guardrails, upstream sources)

### Staged Changes
A floating bottom bar appears when changes are staged: `"3 changes staged"` with **Preview & Save** and **Discard** buttons.

### Save Flow
1. Click "Preview & Save"
2. Modal shows each file that will change with a unified diff (green/red lines)
3. User reviews → "Save" or "Cancel"
4. POST to `/api/save` → server writes YAML files
5. File watcher detects change → recompiles → re-lints → pushes new tier score via SSE
6. Tier scorecard updates live on the page
7. Lint diagnostics panel shows remaining issues

### Live Tier Scorecard
The existing 3-column Bronze/Silver/Gold scorecard on model pages updates in real-time via SSE after each save. Shows which checks pass/fail so users know what to curate next.

## Implementation Details

### Package Changes

**`@runcontext/site`**
- Add `studioMode` parameter to `generateSite()`
- When true, templates include: edit buttons, contenteditable attributes, dropdown controls, staged-changes floating bar, save modal with diff viewer, SSE listener script
- All client-side code is vanilla JS embedded in EJS templates — no framework

**`@runcontext/cli` (`dev.ts`)**
- Add `--studio` and `--port` flags to `context dev`
- When `--studio`, start HTTP server using Node's built-in `http` module (4 routes, no Express needed)
- Serve generated site HTML (regenerated on file change, cached between)
- Expose `/api/preview`, `/api/save`, `/api/events` endpoints
- Open browser automatically on start
- Existing lint-on-change behavior continues alongside

**Save API (`POST /api/save`)**
- Payload: `{ file: "context/governance/orders.governance.yaml", path: "datasets.0.fields.3.semantic_role", value: "metric" }`
- Reads current YAML, applies change at specified path, writes back
- Uses `yaml` package (already in `@runcontext/core`) for comment-preserving round-trip

**Preview API (`POST /api/preview`)**
- Same payload as save, returns `{ filename, before, after, diff }` without writing

### Dependencies
No new npm dependencies:
- Node's `http` module for the server
- Existing `yaml` package for YAML round-tripping
- Existing `chokidar` for file watching

### Security
- Server binds to `localhost` by default
- `--host` flag allows exposing to network for team use

## What This Enables

```
Database → context introspect → YAML (Bronze)
                                   ↓
                        context dev --studio
                                   ↓
                    Human edits in browser → YAML (Gold)
                                   ↓
                        context serve (MCP)
                                   ↓
                    AI agent gets curated context
```

The full loop: database to AI-ready semantic layer, with a human-in-the-loop editor that makes Gold tier achievable without YAML expertise.
