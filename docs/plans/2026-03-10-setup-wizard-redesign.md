# Setup Wizard UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the `context setup` browser wizard from a basic centered form into a full app-shell layout matching the Cloud dashboard.

**Architecture:** Replace CSS, HTML template, and client JS in `packages/ui/`. Vanilla JS/CSS, no frameworks. Hono server unchanged. UXD tokens for all styling.

**Tech Stack:** Vanilla JS, CSS custom properties (UXD tokens), Hono server (unchanged)

---

### Task 1: CSS Foundation — App-Shell Layout + UXD Tokens

**Files:**
- Rewrite: `packages/ui/static/setup.css`
- Reference: `packages/uxd/dist/css/tokens.css`

**Step 1: Read the current CSS and UXD tokens**

Read `packages/ui/static/setup.css` and `packages/uxd/dist/css/tokens.css` to understand existing styles and available tokens.

**Step 2: Write the new CSS file**

Replace `packages/ui/static/setup.css` entirely with app-shell layout CSS:

- **App shell:** `.app-shell` grid layout with fixed sidebar (240px), header, main, footer
- **Sidebar:** `.sidebar` with brand area, nav items, bottom status panel. Nav items have `.active` (gold left border, gold text), `.locked` (dimmed, cursor not-allowed), `.status-dot` (green/red)
- **Header:** `.header-stepper` breadcrumb with `.step-completed` (gold, clickable), `.step-active` (white, bold), `.step-future` (muted). Separator `>` chars in muted color
- **Main content:** `.main-content` max-width 800px, centered padding
- **Footer:** `.app-footer` with muted text, matching docs/marketing
- **Cards:** `.card` with `var(--rc-color-surface-card)` background, border-radius, padding
- **Form inputs:** `var(--rc-color-surface-bg)` background, `var(--rc-color-border-default)` border, `var(--rc-color-brand-gold)` focus ring
- **Labels:** `var(--rc-color-text-secondary)`, small-caps
- **Pipeline accordion:** `.pipeline-stage` collapsible cards with `.stage-pending` (gray dot), `.stage-running` (animated gold dot), `.stage-done` (green check), `.stage-error` (red dot)
- **Locked tooltip:** `.locked-tooltip` positioned inline below nav item
- **Tier badge:** `.tier-badge` matching Cloud badge style
- **Completion card:** `.completion-card` with CTA buttons (`.btn-primary` gold, `.btn-secondary` outline)
- **Fonts:** Plus Jakarta Sans for headings, Geist Mono for code — loaded via Google Fonts link in HTML
- **Responsive:** Sidebar collapses on screens < 768px

All colors, spacing, radii, shadows use `var(--rc-*)` tokens. No hardcoded values except fallbacks.

**Step 3: Verify CSS loads**

Run: `cd /tmp/runcontext-e2e-test/saber-alert && npx runcontext setup`
Open browser, verify app-shell grid renders (sidebar + header + main + footer visible, even if content is broken).

**Step 4: Commit**

```bash
git add packages/ui/static/setup.css
git commit -m "feat(ui): rewrite setup wizard CSS with app-shell layout and UXD tokens"
```

---

### Task 2: HTML Template — Sidebar, Header, Footer

**Files:**
- Modify: `packages/ui/src/server.ts` (function `setupPageHTML` around line 75)
- Reference: `packages/ui/static/setup.css` (from Task 1)

**Step 1: Read the current server.ts**

Read `packages/ui/src/server.ts` to understand the `setupPageHTML()` function and how HTML is served.

**Step 2: Rewrite the HTML template**

Replace the body content in `setupPageHTML()` with the app-shell structure:

```
<div class="app-shell">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <svg class="brand-chevron">...</svg>
      <span class="brand-text">
        <span class="brand-run">Run</span><span class="brand-context">Context</span>
      </span>
      <span class="brand-badge">Local</span>
    </div>
    <nav class="sidebar-nav">
      <a class="nav-item active" data-nav="setup">Setup</a>
      <a class="nav-item locked" data-nav="planes">
        <span>Semantic Planes</span>
        <svg class="lock-icon">...</svg>
      </a>
      <a class="nav-item locked" data-nav="analytics">
        <span>Analytics</span>
        <svg class="lock-icon">...</svg>
      </a>
      <a class="nav-item" data-nav="mcp">
        <span class="status-dot" id="mcp-status-dot"></span>
        <span>MCP Server</span>
        <span class="nav-detail" id="mcp-status-text">checking...</span>
      </a>
      <a class="nav-item locked" data-nav="settings">
        <span>Settings</span>
        <svg class="lock-icon">...</svg>
      </a>
    </nav>
    <div class="sidebar-status">
      <div class="status-row">
        <span class="status-dot" id="db-status-dot"></span>
        <span id="db-status-text">No database</span>
      </div>
      <div class="status-row">
        <span class="status-dot" id="mcp-server-dot"></span>
        <span id="mcp-server-text">MCP stopped</span>
      </div>
      <div class="status-row" id="tier-row">
        <span class="tier-badge" id="tier-badge">Free</span>
      </div>
    </div>
  </aside>

  <!-- Header -->
  <header class="app-header">
    <div class="header-stepper" id="stepper"></div>
  </header>

  <!-- Main -->
  <main class="main-content">
    <div class="content-wrapper" id="wizard-content"></div>
  </main>

  <!-- Footer -->
  <footer class="app-footer">
    <span>Powered by RunContext · Open Semantic Interchange</span>
  </footer>
</div>

<!-- Locked tooltip (hidden by default) -->
<div class="locked-tooltip" id="locked-tooltip" style="display:none">
  <p>Available on RunContext Cloud</p>
  <a href="https://runcontext.dev/pricing" target="_blank">Learn more</a>
</div>
```

- Add Google Fonts link for Plus Jakarta Sans and Geist Mono in the `<head>`
- Keep the UXD tokens CSS link
- Keep setup.js and setup.css script/link tags

**Step 3: Build and verify**

Run: `cd /Users/erickittelson/Code/RunContext/runcontext && pnpm build --filter=@runcontext/ui`
Then start: `cd /tmp/runcontext-e2e-test/saber-alert && npx runcontext setup`
Verify sidebar, header, footer render correctly in browser.

**Step 4: Commit**

```bash
git add packages/ui/src/server.ts
git commit -m "feat(ui): add app-shell HTML template with sidebar, header, footer"
```

---

### Task 3: Client JS — Navigation, Sidebar, Breadcrumb Stepper

**Files:**
- Rewrite: `packages/ui/static/setup.js`

**Step 1: Read the current setup.js**

Read `packages/ui/static/setup.js` to understand state management, step navigation, form validation, and API calls.

**Step 2: Rewrite setup.js**

Replace entirely. The new JS must handle:

**Breadcrumb stepper** (rendered into `#stepper`):
- Steps: `['Product', 'Owner', 'Context', 'Review', 'Build']`
- Render using DOM API (`document.createElement`): each step is a `<span>` with appropriate class
- Completed steps: class `step-completed`, gold text, clickable (navigates back)
- Active step: class `step-active`, white bold
- Future steps: class `step-future`, muted, not clickable
- Separators: `>` character spans with class `step-separator`

**Step content** (rendered into `#wizard-content`):
- Each step renders a `.card` with form fields or content
- Use DOM API to create elements — `document.createElement`, `element.textContent`, `element.appendChild`
- Steps 1-3: Same fields as current (product name, owner info, data source config)
- Step 4: Review card (Task 5 handles details)
- Step 5: Pipeline accordion (Task 4 handles details)

**Sidebar interactions:**
- Locked items: on click, position and show `#locked-tooltip` below the clicked item, dismiss on click elsewhere
- MCP status: poll `/health` endpoint, update `#mcp-status-dot` and `#mcp-status-text`
- DB status: update when data source is configured in Step 3

**State management:**
- Same pattern as current: object with step data, current step index
- Navigation: `goToStep(n)` updates stepper, renders content, scrolls to top
- Form validation: same rules as current
- Preserve all existing API calls (`/api/setup/*` routes)

**Step 3: Verify navigation works**

Run setup wizard, click through all steps, verify:
- Stepper updates correctly
- Forms render and validate
- Back navigation via completed steps works
- Locked sidebar items show tooltip

**Step 4: Commit**

```bash
git add packages/ui/static/setup.js
git commit -m "feat(ui): rewrite setup wizard JS with sidebar, stepper, DOM-based rendering"
```

---

### Task 4: Pipeline Accordion — Expand/Collapse + Live Details

**Files:**
- Modify: `packages/ui/static/setup.js` (pipeline section of Step 5)
- Modify: `packages/ui/static/setup.css` (accordion animations)

**Step 1: Read current pipeline rendering**

Read the Step 5 / pipeline section of `setup.js` to understand how stages are polled and displayed.

**Step 2: Implement accordion pipeline**

Add to setup.js — the Step 5 renderer creates accordion stages:

**Top line:** "Building semantic plane for **{product}** from **{adapter}:{source}**"

**Each stage** is a `.pipeline-stage` div:
- Header row: status indicator + stage name + summary (when done)
- Collapsible body: detailed content per stage
- Click header to toggle expand/collapse

**Status indicators** (CSS classes set per state):
- `.stage-pending`: gray circle, "Waiting..."
- `.stage-running`: animated gold circle (CSS `@keyframes pulse`), "Running..."
- `.stage-done`: green checkmark (Unicode ✓ or SVG), summary text
- `.stage-error`: red circle, error message

**Auto-behavior:**
- When a stage starts running, auto-expand it and collapse previous
- When a stage completes, collapse to summary
- Completed stages remain clickable to re-expand

**Expanded content per stage** (use `document.createElement` and `textContent`):
1. **Introspect:** DB connection string (password masked), table list with row counts
2. **Scaffold:** Generated file list with sizes
3. **Enrich Silver:** Fields enriched count, sample descriptions
4. **Enrich Gold:** Semantic roles count, aggregations set
5. **Verify:** Pass/warn/fail counts
6. **Autofix:** Fixes applied count
7. **Agent Instructions:** Generated file path

**Step 3: Add accordion CSS**

Add to setup.css:
- `.pipeline-stage-body` with `max-height: 0; overflow: hidden; transition: max-height 0.3s ease`
- `.pipeline-stage.expanded .pipeline-stage-body` with `max-height: 500px`
- `@keyframes pulse` for running indicator
- Stage detail tables/lists styling

**Step 4: Test with live build**

Run: `cd /tmp/runcontext-e2e-test/saber-alert && npx runcontext setup`
Complete steps 1-3, start build, verify:
- Stages animate through pending → running → done
- Auto-expand/collapse works
- Click to re-expand completed stages works
- Details show real data from the build

**Step 5: Commit**

```bash
git add packages/ui/static/setup.js packages/ui/static/setup.css
git commit -m "feat(ui): add pipeline accordion with expand/collapse and live stage details"
```

---

### Task 5: Review Step — Edit Links + Grouped Sections

**Files:**
- Modify: `packages/ui/static/setup.js` (Step 4 renderer)

**Step 1: Implement review card**

The Step 4 renderer creates a `.card` with three grouped sections using DOM API:

**Product section:**
- Label: "Product"
- Value: product name
- "Edit" link → `goToStep(0)`

**Owner section:**
- Label: "Owner"
- Values: owner name, email, org
- "Edit" link → `goToStep(1)`

**Context section:**
- Label: "Data Source"
- Values: adapter icon + name, connection status dot (green/red), source identifier
- "Edit" link → `goToStep(2)`

Each section is a `.review-section` with a `.review-header` (section title + edit link) and `.review-body` (key-value pairs).

**Completion state** (after pipeline finishes):
- Success card with heading "Your semantic plane is ready"
- Tier badge
- Two CTA buttons:
  - "Start MCP Server" (gold primary button) — calls API to start server
  - "Publish to Cloud" (secondary outline button) — links to app.runcontext.dev
- Next steps with CLI commands in `<code>` blocks

**Step 2: Test review step**

Fill in steps 1-3 with test data, navigate to step 4, verify:
- All entered data appears correctly
- Edit links navigate to correct steps
- After pipeline completion, success card appears with CTAs

**Step 3: Commit**

```bash
git add packages/ui/static/setup.js
git commit -m "feat(ui): add review step with edit links and completion card"
```

---

### Task 6: E2E Test with Playwright

**Files:**
- Create: `packages/ui/tests/setup-wizard.spec.ts`

**Step 1: Write E2E test**

Create a Playwright test that:
1. Starts the setup wizard server
2. Opens the browser to the setup URL
3. Verifies app-shell layout renders (sidebar, header, footer visible)
4. Verifies sidebar brand shows "RunContext" with "Local" badge
5. Clicks through steps 1-3, filling in form data
6. Verifies breadcrumb stepper updates (completed steps gold, active white)
7. Clicks a locked sidebar item, verifies tooltip appears
8. Navigates to review step, verifies data appears
9. Clicks "Edit" link, verifies navigation back to correct step
10. Starts build, verifies pipeline accordion stages animate

Use Playwright's `page.locator()` and `expect()` assertions.

**Step 2: Run the test**

Run: `cd /Users/erickittelson/Code/RunContext/runcontext && npx playwright test packages/ui/tests/setup-wizard.spec.ts`
Expected: All assertions pass.

**Step 3: Commit**

```bash
git add packages/ui/tests/setup-wizard.spec.ts
git commit -m "test(ui): add E2E test for setup wizard redesign"
```

---

### Task 7: Push + Verify

**Step 1: Run full test suite**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext && pnpm test
```

**Step 2: Build all packages**

```bash
pnpm build
```

**Step 3: Manual smoke test**

Start setup wizard against the Neon test DB:
```bash
cd /tmp/runcontext-e2e-test/saber-alert && npx runcontext setup
```
Walk through the entire flow visually. Check:
- App-shell layout looks polished
- Sidebar brand, nav, status panel all correct
- Breadcrumb stepper navigation works
- Forms styled with UXD tokens
- Pipeline accordion animates smoothly
- Review step shows correct data with working edit links
- Completion card CTAs work
- Locked item tooltips appear and dismiss
- Footer visible

**Step 4: Push**

```bash
git push origin main
```
