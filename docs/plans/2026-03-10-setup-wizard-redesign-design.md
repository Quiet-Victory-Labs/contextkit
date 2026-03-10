# Setup Wizard UI Redesign

## Goal

Redesign the `context setup` browser wizard from a basic centered form into a full app-shell layout matching the Cloud dashboard (app.runcontext.dev). The local experience mirrors the Cloud experience, with locked items showing what Cloud unlocks.

## Architecture

The setup wizard is a vanilla JS/CSS single-page app served by the `@runcontext/ui` Hono server from the CLI. No frameworks. The redesign replaces the HTML template in `server.ts`, the client JS in `static/setup.js`, and the CSS in `static/setup.css`.

## Layout

Full app-shell: fixed sidebar (240px) + header + main content + footer.

### Sidebar

- **Brand:** Gold chevron icon + "Run" (white) + "Context" (gold) + "Local" badge (gold border/bg matching Cloud's "CLOUD" badge)
- **Nav items:**
  - Setup (active state: gold left border, gold text)
  - Semantic Planes (dimmed, lock icon, tooltip on click: "Available on RunContext Cloud" + "Learn more" link to pricing)
  - Analytics (dimmed, locked, same tooltip)
  - MCP Server (green/red status dot + "running on :3333" or "stopped")
  - Settings (dimmed, locked)
- **Bottom status panel:**
  - Connected DB with green/red dot and adapter:name
  - MCP server status
  - Current tier with TierBadge

### Header

- Breadcrumb stepper: `Product > Owner > Context > Review > Build`
  - Completed: gold text, clickable
  - Active: white text, bold
  - Future: muted text, not clickable
  - Separator: `>` in muted color
- No circles, no connecting lines

### Main Content

- Max-width 800px within the content area
- Padding matches Cloud dashboard spacing
- Each step is a card on surface-card background

### Footer

- "Powered by RunContext . Open Semantic Interchange"
- Matching docs/marketing site footer style

## Step Content

### Steps 1-3 (Forms)

Same fields as current. Better styling with UXD tokens:
- Inputs: surface-bg background, border-default borders, brand-gold focus ring
- Labels: text-secondary, small caps
- Cards group related fields
- Voice input button styled as icon button

### Step 4 (Review)

Card with three grouped sections: Product, Owner, Context. Each section has an "Edit" link that navigates back to that step. Data source shows adapter icon and connection status dot.

### Step 5 (Build Pipeline - Accordion)

Top line: "Building semantic plane for **{product}** from **{adapter}:{source}**"

Each pipeline stage is a collapsible card:

**States:**
- Pending: gray dot, stage name, "Waiting..."
- Running: animated gold dot, stage name, "Running..."
- Done: green checkmark, stage name, summary (e.g., "42 tables, 502 columns")
- Error: red dot, stage name, error message

**Behavior:**
- Auto-expands active stage
- Auto-collapses to summary when done
- Click any completed stage to re-expand and see details

**Expanded content per stage:**
1. Introspect: DB connection string (masked password), table list with row counts
2. Scaffold: Generated file list with sizes
3. Enrich Silver: Fields enriched count, sample descriptions
4. Enrich Gold: Semantic roles added, aggregations set
5. Verify: Pass/warn/fail counts with details
6. Autofix: Fixes applied count
7. Agent Instructions: Generated file path

### Completion State

Success card after pipeline finishes:
- Heading: "Your semantic plane is ready"
- Tier badge
- Two CTA buttons: "Start MCP Server" (gold primary) and "Publish to Cloud" (secondary, links to app.runcontext.dev)
- Next steps with CLI commands in code blocks

## Locked Items (Cloud Upsell)

When a locked sidebar item is clicked, show an inline tooltip:
- "Available on RunContext Cloud"
- "Learn more" link to runcontext.dev/pricing
- Tooltip auto-dismisses on click elsewhere

## Styling

All UXD tokens: --rc-color-*, --rc-font-*, --rc-radius-*, --rc-space-*. Same dark theme as Cloud dashboard. Plus Jakarta Sans headings, Geist Mono code. Gold accent for active/focus states.

## Tech Stack

- Vanilla JS + CSS (no frameworks, matching current approach)
- Hono server (unchanged)
- UXD tokens CSS loaded from @runcontext/uxd/css/tokens
- API routes unchanged

## Files Changed

- `packages/ui/src/server.ts` — New HTML template with app-shell layout
- `packages/ui/static/setup.js` — Rewritten client JS with sidebar, stepper, accordion
- `packages/ui/static/setup.css` — Rewritten CSS matching Cloud dashboard
