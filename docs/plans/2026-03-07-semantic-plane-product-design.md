# ContextKit: The Semantic Plane — Full Product Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plans for each stage.

**Goal:** Transform ContextKit from a CLI metadata tool into a full product platform — local-first semantic plane builder with a cloud monetization path.

**Core insight:** Your data is what AI doesn't have. Context around it is what AI needs. ContextKit gets institutional knowledge into AI's hands — safe, reliable, version-controlled.

---

## Table of Contents

1. [Brand Identity & Messaging](#1-brand-identity--messaging)
2. [Product Architecture](#2-product-architecture)
3. [Stage 1: The Onboarding Experience](#3-stage-1-the-onboarding-experience)
4. [Stage 2: The Semantic Plane](#4-stage-2-the-semantic-plane)
5. [Stage 3: RunContext Cloud](#5-stage-3-runcontext-cloud)
6. [Stage 4: Brand & Growth](#6-stage-4-brand--growth)

---

## 1. Brand Identity & Messaging

### Brand Hierarchy

- **ContextKit** — the product. The CLI. The open source project. The thing you install.
- **RunContext** — the company. The cloud platform. runcontext.dev.
- **OSI** — Open Semantic Interchange. The open standard format for portable metadata.
- **Semantic Plane** — the product concept. Your curated metadata layer, thin or dense.
- **BYOMCP** — Bring Your Own MCP. The DIY local path. Funny, memorable, honest.

### Tagline

*Your data is what AI doesn't have. Context is what AI needs.*

### The Pitch

ContextKit builds your semantic plane locally — free, open source, yours forever. Connect it to Claude Code, Cursor, Windsurf, GitHub Copilot, OpenAI Codex, or any MCP-compatible tool. Your data. Your context. Your machine.

Want to take it further? RunContext Cloud hosts your semantic plane, serves it globally over secure MCP, and connects read-only to your warehouses. No infrastructure to figure out. No MCP servers to configure. No hosting to manage.

Or go BYOMCP — Bring Your Own MCP. Wire it up yourself. We respect that. But when your team grows, when you need RBAC, audit logs, and enterprise connectors — we'll be here.

### Messaging Pillars

| Pillar | Message |
|--------|---------|
| **The Problem** | AI agents guess at your data. They hallucinate column meanings, miss business rules, ignore guardrails. Every wrong query costs time, trust, and money. |
| **The Solution** | ContextKit turns institutional knowledge into AI-ready metadata. One semantic plane. Every agent. Every query. Correct. |
| **Local-First** | Build locally. Free forever. Works with every AI tool on your machine — Claude Code, Cursor, Copilot, Windsurf, Codex. No cloud required. |
| **Open Standard** | Built on OSI — the Open Semantic Interchange format. Your metadata is portable, version-controlled, never locked in. |
| **Safe by Construction** | Read-only connectors. No write access. No mutations. Your warehouse is observed, never touched. Credential-level, code-level, runtime-level safety. |
| **Human + AI** | You provide the context. AI curates the data. Together you build Gold-tier data products in minutes, not months. |
| **Cloud When Ready** | BYOMCP works. But when you want hosted MCP, secure connectors, team access, and zero infrastructure — RunContext Cloud is one command away. |

### SEO / Keyword Targets

Primary:
- "semantic layer for AI agents"
- "MCP semantic layer"
- "AI-ready data catalog"
- "data product metadata"
- "LLM data context"

Secondary:
- "open semantic interchange"
- "AI data governance"
- "semantic layer MCP server"
- "data product builder"
- "metadata for AI agents"
- "bring your own MCP"
- "AI data guardrails"
- "golden queries AI"

Long-tail:
- "how to build semantic layer for cursor"
- "connect data warehouse to claude code"
- "AI agent wrong SQL fix"
- "metadata curation tool open source"
- "institutional knowledge for AI"

### Brand Vocabulary

| Term | Definition |
|------|-----------|
| **Semantic Plane** | Your curated metadata layer. Can be thin (one data product) or dense (dozens). Always expandable. |
| **Data Product** | One unit of curated metadata within the semantic plane. Has its own context brief, models, governance, rules, lineage. |
| **Context Brief** | What you tell AI before it starts. The human context that data alone can't provide. Saved as `context-brief.yaml`. |
| **BYOMCP** | Bring Your Own MCP. The local DIY path. You figure out MCP hosting and connectors. Free. |
| **Gold-Tier** | Fully AI-ready metadata: semantic roles, guardrails, golden queries, business rules, lineage. The highest curation level. |
| **Safe by Construction** | Read-only at every layer — credentials, application code, and runtime. Not "we promise not to write." Structurally incapable of writing. |
| **Bronze / Silver / Gold** | The three tiers of metadata maturity. Bronze = discoverable. Silver = trusted. Gold = AI-ready. |

### Messaging Matrix

| Audience | Local (free) | Cloud (paid) |
|----------|-------------|-------------|
| **Solo dev** | "Build a semantic plane for your project in 5 minutes. Every AI tool you use gets smarter." | "Not needed yet — local is plenty." |
| **Small team** | "Your team's institutional knowledge, version-controlled in Git. AI stops guessing." | "Share your semantic plane with every AI tool your team uses. One MCP endpoint." |
| **Enterprise** | "Open standard. No lock-in. Audit everything. Run it in your own infra." | "Hosted semantic plane + read-only connectors + RBAC + audit logs. Zero infrastructure." |

### The Funnel

```
FREE: context setup → build semantic plane → serve locally → connect any AI tool
         "Every AI tool I use gets my data right now. This is incredible."
                                    ↓
BYOMCP: figure out MCP hosting + cloud deployment yourself
         "OK hosting this and wiring up MCP to my team's tools is harder than I thought"
                                    ↓
PAID: RunContext Cloud
         "Just host it for me. Connect to my Snowflake. Handle the MCP. Here's my card."
```

---

## 2. Product Architecture

### The Semantic Plane

One product. One flow. Always expandable. No "single vs enterprise" mode selection.

```
┌─────────────────────────────────────────────────────────┐
│                  THE SEMANTIC PLANE                       │
│                                                           │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │  Sales    │  │ Marketing │  │  Players  │  + Add     │
│  │  Product  │  │  Product  │  │  Product  │  Product   │
│  └───────────┘  └───────────┘  └───────────┘           │
│                                                           │
│  One manifest. One MCP endpoint. One truth.              │
└─────────────────────────────────────────────────────────┘
```

You start with one data product. Add more anytime. It's always a semantic plane — sometimes thin, sometimes dense.

### Local vs Cloud

| Concern | Local (free) | Cloud (paid) |
|---------|-------------|-------------|
| **Semantic plane storage** | Git repo on your machine | Hosted on RunContext Cloud |
| **MCP serving** | `context serve` on localhost (stdio or HTTP) | `mcp.runcontext.dev/your-org` (Streamable HTTP + auth) |
| **Database connectors** | BYOMCP — use existing MCP servers or configure data_sources in contextkit.yaml | RunContext read-only connectors (safe by construction) |
| **Studio UI** | `context setup` / `context dev --studio` on localhost | `plane.runcontext.dev/your-org` |
| **Team access** | Share the Git repo | RBAC, SSO, approval workflows |
| **AI tool support** | Any local MCP client (Claude Code, Cursor, Copilot, Windsurf, Codex) | Same + remote MCP from any machine in the world |

### Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Onboarding UI** | Hono + Preact | 30-50MB install, single server process, deploys to cloud unchanged |
| **CLI** | Commander.js (existing) | Already built, works well |
| **Core compiler** | TypeScript (existing) | YAML → manifest compilation |
| **MCP server** | TypeScript (existing) | stdio + HTTP transport |
| **Cloud API** | Hono | Same framework as local UI, runs on Cloudflare Workers or Cloud Run |
| **Cloud MCP** | Hono + Streamable HTTP | Standard MCP transport for remote access |
| **Cloud storage** | Postgres + Cloudflare R2 / S3 | Metadata index + artifact storage |
| **Auth** | Clerk or Auth0 | Don't build auth yourself |
| **Payments** | Stripe | Usage-based or seat-based |
| **Read-only connectors** | Custom TypeScript adapters | Snowflake, BigQuery, Postgres, Neon, Iceberg. Read-only at every layer. |

---

## 3. Stage 1: The Onboarding Experience

### Overview

Replace `context setup` (CLI wizard) with a browser-based onboarding UI. When you run `context setup`, it starts a local Hono+Preact server and opens your browser to a beautiful multi-step form.

### The Flow

```
User runs: context setup
     ↓
Hono server starts on localhost:4040
Browser opens automatically
     ↓
User sees: The Context Brief form (5 steps)
     ↓
Step 1: "Tell us about your data" (voice-to-text or type)
Step 2: "Who owns this?" (name, team, email)
Step 3: "How sensitive?" (4 cards to pick from)
Step 4: "Got docs?" (drag-and-drop upload)
Step 5: "Connect your data" (auto-detected sources)
     ↓
Form submits → saves context-brief.yaml
     ↓
UI shows: "AI is curating your data product..."
  - Introspect database
  - Scaffold Bronze metadata
  - Enrich to Silver (heuristics)
  - Verify against live data
  - Generate agent instructions
     ↓
Redirects to Studio for refinement
```

### The Context Brief Form

**Step 1 — "Tell us about your data"**

The most important field. Big text area with voice-to-text toggle (browser SpeechRecognition API).

Placeholder text: *"Describe what this data is, what decisions it supports, and what metrics matter most. The more context you give, the better AI can curate your metadata. Example: 'Player engagement metrics for our live service games. We track DAU, session length, and churn so analytics can report to leadership weekly.'"*

This field gives AI: domain, purpose, candidate metrics, audience, cadence, business context.

**Step 2 — "Who owns this?"**

Three simple fields: Name, Team, Email. AI cannot get organizational ownership from data.

**Step 3 — "How sensitive is this data?"**

Four cards, pick one:

| Level | Label | Description |
|-------|-------|-------------|
| Public | "Anyone can see it" | Open data, public APIs, marketing stats |
| Internal | "Company eyes only" | Internal metrics, operational data |
| Confidential | "Need to know" | PII, financial data, HR records |
| Restricted | "Locked down" | Regulated data, trade secrets, security logs |

AI can flag PII candidates from column names, but can't know the org's classification policy.

**Step 4 — "Got any existing documentation?"**

Drag-and-drop upload area. Accepts PDF, images, markdown, text, CSV. Files land in `context/docs/` (or `products/{name}/docs/` in multi-product mode).

Message: *"Data dictionaries, ERDs, Confluence exports, Slack threads — anything that describes this data. AI will reference these while curating."*

Optional. If skipped, AI works without docs.

**Step 5 — "Connect your data"**

Auto-detect available connections:
- MCP config files (`.claude/mcp.json`, etc.)
- Environment variables (`DATABASE_URL`, `DUCKDB_PATH`, `SNOWFLAKE_ACCOUNT`)
- `contextkit.yaml` data_sources

Show a card for each detected source with connection type and status. User clicks to confirm which one this data product connects to.

If no sources detected, show: *"No data sources found. Add a connection string to contextkit.yaml or set DATABASE_URL."* with a code example.

### Context Brief Schema

Output file: `context-brief.yaml` (or `products/{name}/context-brief.yaml`)

```yaml
product_name: player-engagement
description: |
  Player engagement metrics for our live service games.
  We need to track DAU, session length, and churn so the
  analytics team can report to leadership weekly.
owner:
  name: Tyler Chen
  team: Analytics
  email: tyler@company.com
sensitivity: internal
data_source: snowflake_prod
docs:
  - docs/player-data-dictionary.pdf
  - docs/engagement-model-erd.png
created_at: 2026-03-07T12:00:00Z
```

### Post-Submission Pipeline

After the brief is saved, the existing setup pipeline runs automatically:

1. **Introspect** — Connect to data source, extract tables/columns/types/PKs
2. **Scaffold Bronze** — Generate OSI YAML, governance, rules, lineage files
3. **Enrich to Silver** — Auto-fill descriptions, relationships, sample values via heuristics
4. **Verify** — Validate metadata against live database
5. **Auto-fix** — Apply linting fixes
6. **Generate Agent Instructions** — Create `AGENT_INSTRUCTIONS.md` with the context brief embedded

The UI shows real-time progress for each step. On completion, redirects to Studio.

### Technical Implementation

New package: `packages/ui/`

```
packages/ui/
  package.json
  tsconfig.json
  src/
    server.ts                    # Hono app — serves UI + API routes
    routes/
      api/brief.ts               # POST /api/brief — save context brief
      api/upload.ts              # POST /api/upload — file upload handler
      api/sources.ts             # GET /api/sources — detect data sources
      api/pipeline.ts            # POST /api/pipeline/start, GET /api/pipeline/status
    pages/
      setup/
        index.tsx                # Wizard container (Preact)
        Step1Purpose.tsx         # "Tell us about your data"
        Step2Owner.tsx           # "Who owns this?"
        Step3Sensitivity.tsx     # "How sensitive?"
        Step4Docs.tsx            # "Got docs?"
        Step5Source.tsx          # "Connect your data"
        Progress.tsx             # Pipeline progress screen
      studio/                    # Studio pages (migrated from Astro)
    components/
      VoiceInput.tsx             # SpeechRecognition wrapper
      FileUpload.tsx             # Drag-and-drop upload
      SourceCard.tsx             # Data source display card
      SensitivityCard.tsx        # Sensitivity level picker
    static/
      styles.css                 # Minimal CSS
```

The Hono server replaces the current Astro proxy setup in `packages/cli/src/studio/server.ts`. One server process serves both the onboarding form and the Studio editor.

### CLI Integration

```typescript
// packages/cli/src/commands/setup.ts
export const setupCommand = new Command('setup')
  .description('Build a data product for your semantic plane')
  .option('--port <port>', 'Port for setup UI', '4040')
  .option('--no-browser', 'Don\'t open browser automatically')
  .action(async (opts) => {
    // Start Hono UI server
    // Open browser to localhost:4040/setup
    // Server handles the rest
  });
```

---

## 4. Stage 2: The Semantic Plane (Multi-Product)

### Directory Structure

Always expandable. Start with one product. Add more anytime.

```
my-semantic-plane/
  contextkit.yaml                    ← master config
  products/
    player-engagement/
      context-brief.yaml             ← from onboarding form
      models/player-engagement.osi.yaml
      governance/player-engagement.governance.yaml
      rules/player-engagement.rules.yaml
      lineage/player-engagement.lineage.yaml
      docs/
        player-data-dictionary.pdf
    monetization/
      context-brief.yaml
      models/monetization.osi.yaml
      governance/...
      rules/...
      lineage/...
      docs/
    matchmaking/
      context-brief.yaml
      ...
  glossary/                          ← shared across all products
    churn.term.yaml
    dau.term.yaml
  owners/                            ← shared across all products
    analytics-team.owner.yaml
    platform-team.owner.yaml
  manifest.json                      ← all products compiled together
```

### Key Design Decisions

1. **One product = one subfolder under `products/`**. Each has its own context brief, models, governance, rules, lineage, and docs.

2. **Glossary and owners are shared.** A business term or team owner can span multiple products. They live at the root level.

3. **`contextkit.yaml` is the master config.** Lists all products, shared settings, data sources.

4. **One manifest, one MCP endpoint.** `context build` compiles everything into a single `manifest.json`. `context serve` serves one MCP endpoint with all products. AI agents see the entire semantic plane.

5. **Adding a product = running `context setup` again.** The onboarding form opens. You fill in the brief. A new `products/foo/` folder appears. AI curates it. It joins the plane.

6. **Backward compatible.** Existing users with flat `context/models/foo.osi.yaml` layout are auto-detected as single-product mode. The compiler supports both flat and `products/` layouts.

### Updated Config

```yaml
# contextkit.yaml
context_dir: .                        # root of the semantic plane
output_dir: dist

products:
  - player-engagement
  - monetization
  - matchmaking

glossary_dir: glossary
owners_dir: owners

minimum_tier: bronze

data_sources:
  snowflake_prod:
    adapter: snowflake
    account: ${SNOWFLAKE_ACCOUNT}
    warehouse: ${SNOWFLAKE_WAREHOUSE}
    database: analytics
    user: ${SNOWFLAKE_USER}
    password: ${SNOWFLAKE_PASSWORD}

  neon_dev:
    adapter: postgres
    host: ${NEON_HOST}
    database: dev
    user: ${NEON_USER}
    password: ${NEON_PASSWORD}

site:
  title: "Acme Data Products"

mcp:
  transport: stdio
```

### The "Add Product" Flow

From Studio UI: "+ Add Data Product" button → opens the same onboarding form → creates new `products/` subfolder → AI curates → product appears in the semantic plane.

From CLI: `context setup` detects existing products, asks "Add a new data product to your semantic plane?" → same form flow.

### Manifest Changes

The manifest gains a `products` key that groups models by data product:

```json
{
  "version": "0.5.0",
  "products": {
    "player-engagement": {
      "brief": { ... },
      "models": { ... },
      "governance": { ... },
      "rules": { ... },
      "lineage": { ... }
    },
    "monetization": { ... }
  },
  "glossary": { ... },
  "owners": { ... },
  "tiers": { ... }
}
```

---

## 5. Stage 3: RunContext Cloud

### Phase 3A: Hosted Semantic Plane

**What:** Push your local semantic plane to RunContext Cloud.

```bash
context publish
# Authenticates, uploads manifest + YAML, deploys to cloud
```

**Hosted at:** `https://plane.runcontext.dev/your-org`

Features:
- Web-based Studio (same UI, cloud-deployed)
- REST API: `GET /api/products`, `GET /api/products/{name}`, `GET /api/search`
- Versioned: every publish creates a snapshot
- Rollback: revert to any previous version
- Webhook notifications on publish

### Phase 3B: Hosted MCP

**What:** Your semantic plane served via MCP over Streamable HTTP, accessible from anywhere.

**Endpoint:** `https://mcp.runcontext.dev/your-org`

**Auth:** API key or OAuth 2.1

**How clients connect:**

```json
// In Cursor / Claude Code / any MCP client config
{
  "mcpServers": {
    "my-semantic-plane": {
      "transport": "streamable-http",
      "url": "https://mcp.runcontext.dev/acme-corp",
      "headers": {
        "Authorization": "Bearer sk-..."
      }
    }
  }
}
```

**MCP tools exposed:**
- `context_search` — search across all products, fields, terms
- `context_explain` — full details for a specific product or model
- `context_golden_query` — find pre-validated SQL for a question
- `context_guardrails` — get required WHERE clauses for specified tables
- `context_validate` — run linter against metadata
- `context_tier` — get tier scorecard
- `list_products` — list all data products in the plane
- `get_product` — get a specific data product's full metadata

### Phase 3C: Read-Only Connectors

**What:** RunContext Cloud connects to your warehouses and extracts metadata. Read-only at every layer.

**Supported sources (initial):**
- Snowflake
- BigQuery
- Postgres / Neon
- DuckDB
- Iceberg (via REST catalog)

**Safety model — defense in depth:**

| Layer | Control |
|-------|---------|
| **Credential** | Read-only service account / user. Cannot CREATE, ALTER, DROP, INSERT, UPDATE, DELETE. |
| **Application** | No `run_sql` tool. Only structured metadata extraction functions. No freeform query execution. |
| **Runtime** | Query timeout, row limits, byte limits, rate limits, audit logs. |
| **Network** | Connector runs in isolated container. No outbound access except the configured warehouse. |

**Connector tools (internal, not exposed to MCP clients):**
- `list_schemas`
- `list_tables`
- `describe_table` (columns, types, constraints, comments)
- `get_table_stats` (row count, size, partitions)
- `get_view_definition`
- `detect_relationships` (FK inference)

**Auto-refresh:** Connectors periodically re-inspect. Detect schema drift. Flag changes. Suggest metadata updates as PRs against the semantic plane.

### Phase 3D: Enterprise Features

- **RBAC** — viewer / editor / admin per product or per plane
- **SSO** — Okta, Google Workspace, Azure AD, SAML
- **Audit logs** — every metadata change, every MCP query, every connector run
- **Approval workflows** — editor proposes change → admin reviews diff → approves or rejects
- **Field-level redaction** — hide sensitive metadata from unauthorized MCP clients
- **Custom domains** — `mcp.acme.com` instead of `mcp.runcontext.dev/acme`
- **SLA** — 99.9% uptime guarantee for hosted MCP

### Pricing

| Tier | Price | Includes |
|------|-------|---------|
| **Free (local)** | $0 | CLI + Studio + unlimited products. BYOMCP. |
| **Team** | $49/mo | Hosted plane + MCP. 5 seats. 3 connectors. 10k MCP requests/mo. |
| **Enterprise** | $299/mo | SSO, RBAC, audit logs, unlimited seats + connectors + requests. Custom domain. SLA. |

### Cloud Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ RunContext Cloud                                             │
│                                                              │
│  ┌─────────┐    ┌──────────┐    ┌──────────────────┐       │
│  │ Web UI  │    │ REST API │    │ MCP Endpoint     │       │
│  │ (Hono)  │    │ (Hono)   │    │ (Streamable HTTP)│       │
│  └────┬────┘    └────┬─────┘    └────────┬─────────┘       │
│       │              │                    │                  │
│       └──────────────┼────────────────────┘                  │
│                      │                                       │
│              ┌───────┴───────┐                               │
│              │  Service Layer │                               │
│              │  (shared)      │                               │
│              └───────┬───────┘                               │
│                      │                                       │
│         ┌────────────┼────────────┐                          │
│         │            │            │                          │
│    ┌────┴────┐ ┌─────┴─────┐ ┌───┴────┐                    │
│    │ Postgres│ │ R2 / S3   │ │ Auth   │                    │
│    │ (index) │ │ (artifacts)│ │ (Clerk)│                    │
│    └─────────┘ └───────────┘ └────────┘                    │
│                                                              │
│  ┌──────────────────────────────────────────────┐           │
│  │ Read-Only Connectors (isolated containers)    │           │
│  │                                                │           │
│  │  ┌───────────┐ ┌─────────┐ ┌────────┐        │           │
│  │  │ Snowflake │ │ BigQuery│ │Postgres│ ...     │           │
│  │  └───────────┘ └─────────┘ └────────┘        │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Stage 4: Brand & Growth

### Phase 4A: Foundation

**GitHub README** — Complete rewrite:
- Hero: animated terminal GIF showing `context setup` → form → curated data product in 2 minutes
- Tagline: "Your data is what AI doesn't have. Context is what AI needs."
- Badges: npm version, CI status, license, "AI-ready data" custom badge
- Quickstart: 5-line copy-paste to first data product
- Architecture diagram: semantic plane → MCP → AI tools
- "Works with" logos: Claude Code, Cursor, Copilot, Windsurf, Codex
- "BYOMCP or RunContext Cloud — your choice"

**npm package descriptions:**
- `@runcontext/core` — "Compiler and linter for AI-ready semantic metadata. Open Semantic Interchange (OSI) format."
- `@runcontext/cli` — "Build semantic planes from your data. AI-ready metadata in minutes."
- `@runcontext/mcp` — "MCP server for serving semantic metadata to AI agents. Works with Claude Code, Cursor, and more."
- `@runcontext/site` — "Documentation site generator for semantic planes. Browse your data products."
- `@runcontext/ui` — "Onboarding and studio UI for ContextKit. Build data products in the browser."
- `create-contextkit` — "Scaffold a new semantic plane. AI-ready data starts here."

**runcontext.dev** — Marketing + docs site:
- Landing page with the full pitch
- Docs (already exists via Starlight)
- Pricing page
- "Works with" integrations page
- Blog

### Phase 4B: Content & SEO

**Blog post calendar (targeting keyword clusters):**

| Post | Target Keywords |
|------|----------------|
| "Why Your AI Agents Write Wrong SQL (And How to Fix It)" | AI wrong SQL, LLM data errors, AI data quality |
| "How to Build a Semantic Layer for AI Agents" | semantic layer AI, MCP semantic layer |
| "Open Semantic Interchange: A Portable Metadata Standard" | open semantic interchange, OSI metadata, portable semantic layer |
| "BYOMCP: Connecting Your Data to Every AI Tool" | bring your own MCP, MCP data connector |
| "From Bronze to Gold: Curating Data Products with AI" | data product curation, AI metadata, data governance tiers |
| "Institutional Knowledge is Your AI's Missing Context" | institutional knowledge AI, AI context, company data AI |
| "ContextKit vs Alation vs Atlan: Why Open Source Wins" | data catalog comparison, open source data catalog |
| "How to Serve Your Data Catalog to Claude Code via MCP" | claude code MCP, data catalog MCP server |

**Distribution:** Dev.to, Hashnode, Medium, Hacker News, r/dataengineering, r/MachineLearning, dbt Slack, MCP Discord.

### Phase 4C: Community & Distribution

- **dbt integration** — import metadata from dbt. Blog: "ContextKit for dbt users." Target the dbt community hard — they have metadata but no AI serving layer.
- **MCP registries** — list ContextKit in every MCP directory, awesome-mcp lists, Anthropic's MCP showcase.
- **GitHub Actions** — `runcontext/lint-action` for CI validation of semantic planes.
- **VS Code extension** — browse your semantic plane from the editor sidebar.
- **Discord community** — ContextKit Discord for users, contributors, and data teams.
- **Conference talks** — "AI-Ready Data: Building Semantic Planes for the Agent Era" at dbt Coalesce, Data Council, AI Engineer Summit.

### Phase 4D: Messaging on Every Surface

Every touchpoint should reinforce the brand:

| Surface | Message |
|---------|---------|
| **npm install output** | `Run 'context setup' to build your first data product.` |
| **CLI startup banner** | `ContextKit — AI-ready data starts here` |
| **Setup form header** | `Build your data product. AI handles the rest.` |
| **Setup completion** | `Your semantic plane is live. AI agents can now query your data with context.` |
| **Studio header** | `[Product Name] — Semantic Plane` |
| **Studio footer** | `Powered by ContextKit · Open Semantic Interchange` |
| **MCP server startup** | `Serving semantic plane via MCP. Connected AI tools will now have context.` |
| **GitHub repo description** | `Build AI-ready semantic planes from your data. Open source. Open standard. Local-first.` |
| **Cloud login page** | `Your institutional knowledge. Every AI agent. One semantic plane.` |
| **Cloud dashboard** | `[Org Name] Semantic Plane — [N] data products · [N] AI queries today` |
| **Error: no products** | `No data products found. Run 'context setup' to build your first one.` |
| **Error: no MCP** | `Semantic plane built but not serving. Run 'context serve' or try RunContext Cloud.` |
| **404 page** | `This data product doesn't exist yet — but it could. context setup` |
| **Tier badge on products** | Gold shield icon: `AI-Ready` / Silver: `Trusted` / Bronze: `Discoverable` |

---

## Implementation Priority

### Stage 1 (Build Now — Weeks 1-4)
1. **Phase 1A:** `packages/ui/` — Hono+Preact setup, wizard form components
2. **Phase 1B:** Context Brief schema + save/load
3. **Phase 1C:** Replace `context setup` CLI wizard with browser UI
4. **Phase 1D:** Pipeline integration (form → introspect → scaffold → enrich → studio)

### Stage 2 (Build Next — Weeks 5-8)
1. **Phase 2A:** Multi-product directory structure + compiler support
2. **Phase 2B:** Updated contextkit.yaml with products list
3. **Phase 2C:** "Add Product" flow in Studio
4. **Phase 2D:** Shared glossary + owners across products

### Stage 3 (Monetization — Weeks 9-16)
1. **Phase 3A:** `context publish` + hosted semantic plane
2. **Phase 3B:** Hosted MCP endpoint (Streamable HTTP)
3. **Phase 3C:** Read-only connectors (Postgres/Neon first, then Snowflake, BigQuery)
4. **Phase 3D:** Auth, billing, RBAC, enterprise features

### Stage 4 (Parallel with All Stages)
1. **Phase 4A:** GitHub README rewrite, npm descriptions, runcontext.dev marketing pages
2. **Phase 4B:** Blog posts + SEO content
3. **Phase 4C:** Community + distribution (dbt, MCP registries, Discord)
4. **Phase 4D:** Messaging consistency across all surfaces

---

## Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| GitHub stars | 1,000 |
| npm weekly downloads | 5,000 |
| Data products created (telemetry opt-in) | 10,000 |
| Cloud signups | 500 |
| Paying customers | 50 |
| MRR | $5,000 |
| Blog post views | 50,000 total |
| MCP queries served (cloud) | 100,000/mo |

---

*Design approved 2026-03-07. Next: implementation plans per stage.*
