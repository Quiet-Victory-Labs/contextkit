# Unified Setup Flow Design

## Goal

Redesign the setup experience so the AI agent and browser wizard work together as one flow. The agent drives the work via CLI commands; the wizard is a live dashboard reflecting progress. The user can intervene at any point. Database connection uses OAuth-first auth with auto-detection of existing IDE connections.

## Flow

```
Detect → Connect → Define → Scaffold → Checkpoint (Bronze) → Enrich → Verify → Serve
```

All three entry points follow the same flow:
- **Agent-driven:** Agent runs `context setup --agent`, gets a session ID, drives via CLI commands with `--session <id>`
- **Wizard-driven:** User runs `context setup`, browser opens, wizard guides step-by-step
- **Pure CLI:** User runs individual commands (`context auth neon`, `context introspect`). No wizard needed.

## Database Connection

### Step 1: Auto-Detect

MCP discovery scans IDE configs (Claude Code, Cursor, VS Code, Windsurf, Claude Desktop) for existing database connections. If found, wizard shows them as cards with platform logo, database name, and which IDE it was found in. Agent recommends using the detected source.

### Step 2: Platform Auth (if nothing detected)

Wizard shows platform picker grid (Neon, Supabase, Snowflake, BigQuery, AWS RDS, etc.). User picks one. Wizard explains: "We'll connect using RunContext's guardrailed MCP connector. This uses OAuth — you sign in with your own credentials. RunContext never stores your password."

Agent runs `context auth <provider>` → browser OAuth popup → user authenticates → agent receives token → agent calls `provider.listDatabases()` → wizard shows available databases/projects/schemas.

### Step 3: Asset Selection

After auth, wizard shows what the user has access to. Agent recommends relevant assets based on product description. User confirms. Config written to `runcontext.config.yaml` with `auth:` reference (not raw credentials).

Key principle: user credentials never pass through the agent's context. OAuth happens in the user's browser.

## WebSocket Bridge

Setup server adds `/ws` endpoint. CLI and wizard both connect. Events flow bidirectionally.

### CLI/Agent → Wizard (state updates)

- `setup:step` — Navigate wizard to a step
- `setup:field` — Update a form field (agent fills in product name)
- `pipeline:stage` — Stage status change
- `pipeline:detail` — Stage detail update
- `tier:update` — Tier scorecard changed
- `enrich:progress` — Enrichment checklist item updated
- `enrich:log` — Activity log entry

### Wizard → CLI/Agent (user actions)

- `user:field` — User edited a form field
- `user:confirm` — User clicked Continue/Approve
- `user:retry` — User clicked Retry
- `user:cancel` — User cancelled

### Session Binding

`--session <id>` flag on CLI commands ties them to the wizard session. Without it, CLI commands work standalone.

## Wizard Steps

### Connect

Merges old step 3. Shows auto-detected databases first. If none found, shows platform picker → OAuth → database selector. Explains what the RunContext MCP connector is and why it's safe.

### Define

Merges old steps 1-2. Product name, description, owner, sensitivity. Agent can pre-fill these fields via WebSocket.

### Scaffold

Runs introspect + build. Stops at Bronze tier. Shows live progress as schema is extracted. Wizard explains: "Connecting to your database and reading table schemas, column types, and row counts."

### Checkpoint (Bronze)

New step. Shows tier scorecard — what Bronze gives you, what Silver and Gold add. Two choices:

- "Start MCP Server" — done at Bronze, serves what you have
- "Continue to Gold" — starts enrichment

Agent explains the value: "Your semantic plane has basic schema metadata. AI tools can use this now, but with Gold tier they'll understand join relationships, business descriptions, and query patterns."

### Enrich

New step. Two-panel layout:

**Top: Requirements checklist**

Each OSI Gold requirement has a row: Column descriptions, Sample values, Join rules, Grain statements, Semantic roles, Golden queries, Guardrail filters. Each shows status (pending/working/done) with progress counts and details. Updates live via WebSocket as agent works.

**Bottom: Activity log**

Scrolling log of agent actions: "Querying 100 sample rows from alerts...", "Discovered join: alerts.sensor_id → sensors.id", "Writing golden query: Which sensors triggered the most alerts?"

User can click any checklist item to see details, edit descriptions, reject joins, add golden queries.

### Serve

Enhanced completion card. Shows achieved tier (actual, from `context tier`). "Start MCP Server" + "Publish to Cloud" CTAs. CLI command examples. If not at Gold, shows what's still missing with option to continue enrichment later.

## What Changes

### New Code

- WebSocket endpoint in `packages/ui/src/server.ts`
- Event emitter module in `packages/ui/src/events.ts`
- `--session` flag on CLI commands (auth, introspect, enrich, verify, serve)
- Platform picker step in wizard (OAuth flow UI)
- Bronze checkpoint step in wizard (tier scorecard + decision)
- Enrichment dashboard in wizard (requirements checklist + activity log)
- Enrichment orchestrator in `packages/core/src/enrich/` (iterative Gold requirement fulfillment)

### Unchanged

- All CLI commands work standalone without `--session`
- Auth providers (11 platforms already built)
- MCP discovery (already scans IDE configs)
- Adapters (no changes)
- MCP server (no changes)
- App-shell layout (sidebar, header, footer stay)
