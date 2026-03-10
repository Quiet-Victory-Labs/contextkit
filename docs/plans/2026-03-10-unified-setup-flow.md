# Unified Setup Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the AI agent and browser wizard work as one unified flow with real-time WebSocket communication, OAuth-first database auth, Bronze checkpoint, and enrichment dashboard.

**Architecture:** The UI server gains a WebSocket endpoint that bridges CLI/agent actions to the browser wizard. The wizard steps change from [Product, Owner, Context, Review, Build] to [Connect, Define, Scaffold, Checkpoint, Enrich, Serve]. CLI commands gain a `--session <id>` flag to bind to a wizard session. The enrichment dashboard shows a live requirements checklist and activity log.

**Tech Stack:** Hono (HTTP), ws (WebSocket), vanilla JS (IIFE), CSS (UXD tokens), Commander (CLI)

---

### Task 1: WebSocket Event System

Add the `ws` dependency and create the event emitter module that the WebSocket endpoint and pipeline routes will use.

**Files:**
- Create: `packages/ui/src/events.ts`
- Modify: `packages/ui/package.json` (add `ws` dependency)

**Step 1: Add ws dependency**

Run: `cd /Users/erickittelson/Code/RunContext/runcontext && pnpm --filter=@runcontext/ui add ws && pnpm --filter=@runcontext/ui add -D @types/ws`

**Step 2: Create event emitter module**

Create `packages/ui/src/events.ts`:

```typescript
import { EventEmitter } from 'node:events';

export interface SetupEvent {
  type: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

// Agent/CLI -> Wizard event types
export type AgentEventType =
  | 'setup:step'       // Navigate wizard to a step
  | 'setup:field'      // Update a form field value
  | 'pipeline:stage'   // Stage status change
  | 'pipeline:detail'  // Stage detail update
  | 'tier:update'      // Tier scorecard changed
  | 'enrich:progress'  // Enrichment checklist item updated
  | 'enrich:log';      // Activity log entry

// Wizard -> Agent/CLI event types
export type WizardEventType =
  | 'user:field'       // User edited a form field
  | 'user:confirm'     // User clicked Continue/Approve
  | 'user:retry'       // User clicked Retry
  | 'user:cancel';     // User cancelled

class SetupEventBus extends EventEmitter {
  private sessions = new Map<string, { createdAt: string }>();

  createSession(): string {
    const id = crypto.randomUUID();
    this.sessions.set(id, { createdAt: new Date().toISOString() });
    return id;
  }

  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  removeSession(id: string): void {
    this.sessions.delete(id);
  }

  emitEvent(event: SetupEvent): void {
    this.emit('event', event);
    this.emit(event.type, event);
  }
}

export const setupBus = new SetupEventBus();
```

**Step 3: Commit**

```bash
git add packages/ui/src/events.ts packages/ui/package.json pnpm-lock.yaml
git commit -m "feat(ui): add WebSocket event bus for setup sessions"
```

---

### Task 2: WebSocket Endpoint in Server

Wire the WebSocket endpoint into the Hono server so the browser wizard and CLI can communicate in real time.

**Files:**
- Modify: `packages/ui/src/server.ts:175-190` (add WebSocket upgrade to `startUIServer`)
- Create: `packages/ui/src/routes/ws.ts`

**Step 1: Create WebSocket route handler**

Create `packages/ui/src/routes/ws.ts`:

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { setupBus, type SetupEvent } from '../events.js';

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('session');
    const role = url.searchParams.get('role') ?? 'wizard'; // 'wizard' or 'agent'

    if (!sessionId) {
      ws.close(4001, 'session query param required');
      return;
    }

    // Auto-create session if it does not exist (first connector wins)
    if (!setupBus.hasSession(sessionId)) {
      setupBus.createSession();
    }

    // Forward bus events to this WebSocket client
    const onEvent = (event: SetupEvent) => {
      if (event.sessionId !== sessionId) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    };
    setupBus.on('event', onEvent);

    // Receive messages from this client and broadcast via bus
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as SetupEvent;
        msg.sessionId = sessionId;
        setupBus.emitEvent(msg);
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      setupBus.off('event', onEvent);
    });
  });
}
```

**Step 2: Modify startUIServer to attach WebSocket**

In `packages/ui/src/server.ts`, change `startUIServer` to capture the HTTP server and call `attachWebSocket`:

Add import at top:
```typescript
import { attachWebSocket } from './routes/ws.js';
```

Replace the `startUIServer` function body so that after `serve()` returns, we call `attachWebSocket(server)`. The `serve()` from `@hono/node-server` returns a `Server` instance:

```typescript
export function startUIServer(opts: UIServerOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const app = createApp(opts);

    const server = serve({
      fetch: app.fetch,
      port: opts.port,
      hostname: opts.host,
    }, (info) => {
      console.log(`RunContext UI running at http://${opts.host === '0.0.0.0' ? 'localhost' : opts.host}:${info.port}/setup`);
      resolve();
    });

    attachWebSocket(server as unknown as import('node:http').Server);
    server.on('error', reject);
  });
}
```

**Step 3: Add session API route**

Add to `packages/ui/src/server.ts` inside `createApp`, after the health endpoint:

```typescript
app.post('/api/session', (c) => {
  const id = setupBus.createSession();
  return c.json({ sessionId: id });
});
```

And add the import: `import { setupBus } from './events.js';`

**Step 4: Commit**

```bash
git add packages/ui/src/routes/ws.ts packages/ui/src/server.ts
git commit -m "feat(ui): add WebSocket endpoint for wizard-agent bridge"
```

---

### Task 3: CLI `--session` Flag

Add `--session <id>` option to the `setup`, `auth`, `introspect`, `enrich`, and `verify` CLI commands. When present, the CLI sends progress events to the wizard via WebSocket.

**Files:**
- Create: `packages/cli/src/session-bridge.ts`
- Modify: `packages/cli/src/commands/setup.ts:8-13` (add `--session` and `--agent` options)
- Modify: `packages/cli/src/commands/introspect.ts` (add `--session` option)
- Modify: `packages/cli/src/commands/enrich.ts` (add `--session` option)

**Step 1: Create session bridge module**

Create `packages/cli/src/session-bridge.ts`:

```typescript
import WebSocket from 'ws';

export interface SessionBridge {
  send(type: string, payload: Record<string, unknown>): void;
  close(): void;
}

const NOOP_BRIDGE: SessionBridge = {
  send() {},
  close() {},
};

export function createSessionBridge(
  sessionId: string | undefined,
  port: number = 4040,
): SessionBridge {
  if (!sessionId) return NOOP_BRIDGE;

  let ws: WebSocket | null = null;
  const queue: string[] = [];

  try {
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws?session=${encodeURIComponent(sessionId)}&role=agent`);

    ws.on('open', () => {
      for (const msg of queue) {
        ws!.send(msg);
      }
      queue.length = 0;
    });

    ws.on('error', () => {
      // Silently fail — session bridge is best-effort
    });
  } catch {
    return NOOP_BRIDGE;
  }

  return {
    send(type, payload) {
      const msg = JSON.stringify({ type, sessionId, payload });
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      } else {
        queue.push(msg);
      }
    },
    close() {
      ws?.close();
    },
  };
}
```

**Step 2: Add --session to setup command**

In `packages/cli/src/commands/setup.ts`, add two new options:

```typescript
.option('--session <id>', 'Bind to an existing wizard session')
.option('--agent', 'Agent mode: create session, print ID, drive via CLI')
```

In the action handler, when `--agent` is passed, create a session via `POST /api/session` and print the session ID for the agent to use.

**Step 3: Add --session to introspect command**

In `packages/cli/src/commands/introspect.ts`, add:

```typescript
.option('--session <id>', 'Send progress to wizard session')
```

Inside the action, create a `SessionBridge` and call `bridge.send('pipeline:stage', { stage: 'introspect', status: 'running' })` before the work and `bridge.send('pipeline:stage', { stage: 'introspect', status: 'done', summary })` after.

**Step 4: Add --session to enrich command**

Same pattern as introspect. Additionally, send `enrich:progress` and `enrich:log` events as enrichment items are processed.

**Step 5: Add ws dependency to CLI package**

Run: `cd /Users/erickittelson/Code/RunContext/runcontext && pnpm --filter=@runcontext/cli add ws && pnpm --filter=@runcontext/cli add -D @types/ws`

**Step 6: Commit**

```bash
git add packages/cli/src/session-bridge.ts packages/cli/src/commands/setup.ts packages/cli/src/commands/introspect.ts packages/cli/src/commands/enrich.ts packages/cli/package.json pnpm-lock.yaml
git commit -m "feat(cli): add --session flag for wizard-agent bridge"
```

---

### Task 4: Connect Step (Wizard)

Replace old steps 1-3 (Product, Owner, Context) with the new Connect step. Shows auto-detected databases first, then platform picker with OAuth flow.

**Files:**
- Modify: `packages/ui/static/setup.js:5` (change STEP_LABELS)
- Modify: `packages/ui/static/setup.js:216-540` (replace renderStep1, renderStep2, renderStep3 with renderConnectStep)
- Modify: `packages/ui/static/setup.css` (add connect step styles)

**Step 1: Update STEP_LABELS**

Change line 5 from:
```javascript
var STEP_LABELS = ['Product', 'Owner', 'Context', 'Review', 'Build'];
```
to:
```javascript
var STEP_LABELS = ['Connect', 'Define', 'Scaffold', 'Checkpoint', 'Enrich', 'Serve'];
```

Update the `goToStep` switch to handle 6 steps instead of 5.

**Step 2: Build renderConnectStep**

This replaces renderStep1/2/3. The function:
1. Calls `GET /api/sources` to get auto-detected databases
2. Calls `GET /api/auth/providers` to get platform list
3. Shows detected databases as selectable cards (icon, name, origin)
4. If none detected, shows platform picker grid
5. On platform select, calls `POST /api/auth/start` to trigger OAuth
6. After auth, shows database picker from returned list
7. On database select, calls `POST /api/auth/select-db` to save credentials
8. Explains: "RunContext uses OAuth. Your credentials never pass through the AI agent."

Build using `createElement()` helper, no innerHTML.

**Step 3: Add CSS for connect step**

Add to `setup.css`:
- `.source-cards` — grid of detected database cards
- `.source-card` — individual card with hover state
- `.platform-grid` — grid of platform picker buttons
- `.platform-btn` — individual platform button
- `.db-picker` — database selection after OAuth

**Step 4: Commit**

```bash
git add packages/ui/static/setup.js packages/ui/static/setup.css
git commit -m "feat(ui): add Connect step with auto-detect and OAuth"
```

---

### Task 5: Define Step (Wizard)

Merge old Product + Owner steps into a single Define step. Product name, description, owner, sensitivity — all on one screen.

**Files:**
- Modify: `packages/ui/static/setup.js` (add renderDefineStep)

**Step 1: Build renderDefineStep**

This combines the old renderStep1 (product name, description) and renderStep2 (owner name, team, email, sensitivity) into one form. Same fields, same validation, one "Continue" button.

Use `createElement()` for all DOM. Fields: product_name, description, owner.name, owner.team, owner.email, sensitivity dropdown.

Wire up WebSocket listener: if the bus receives `setup:field` events, update the corresponding input value (agent pre-fills fields).

**Step 2: Commit**

```bash
git add packages/ui/static/setup.js
git commit -m "feat(ui): add Define step merging product and owner forms"
```

---

### Task 6: Scaffold + Checkpoint Steps (Wizard)

Replace old Build step. Scaffold runs introspect + build to Bronze. Checkpoint shows tier scorecard with two CTAs.

**Files:**
- Modify: `packages/ui/static/setup.js` (add renderScaffoldStep, renderCheckpointStep)
- Modify: `packages/ui/static/setup.css` (add checkpoint styles)

**Step 1: Build renderScaffoldStep**

This is a slimmed version of the old renderStep5 (Build). It:
1. Calls `POST /api/pipeline/start` with `targetTier: 'bronze'`
2. Shows the pipeline accordion (reuse existing `buildStageElement`)
3. Only shows introspect + scaffold stages (Bronze pipeline)
4. On completion, auto-advances to Checkpoint step

Also listens for `pipeline:stage` WebSocket events to update stage status in real time (instead of polling).

**Step 2: Build renderCheckpointStep**

New step that shows after Bronze scaffold completes:
1. Tier scorecard showing what Bronze gives you and what Silver/Gold add
2. Two CTA buttons:
   - "Start MCP Server" — calls `POST /api/pipeline/start` with just `serve` stage, then goes to Serve step
   - "Continue to Gold" — advances to Enrich step
3. Uses `detectAndShowTier()` to show actual achieved tier

Add CSS:
- `.checkpoint-card` — centered card with tier scorecard
- `.tier-scorecard` — table showing Bronze/Silver/Gold features
- `.checkpoint-ctas` — button group

**Step 3: Commit**

```bash
git add packages/ui/static/setup.js packages/ui/static/setup.css
git commit -m "feat(ui): add Scaffold and Checkpoint steps with tier scorecard"
```

---

### Task 7: Enrich Step (Wizard)

Two-panel enrichment dashboard: requirements checklist on top, activity log on bottom. Updates live via WebSocket.

**Files:**
- Modify: `packages/ui/static/setup.js` (add renderEnrichStep)
- Modify: `packages/ui/static/setup.css` (add enrich dashboard styles)

**Step 1: Build renderEnrichStep**

Two-panel layout:

**Top panel: Requirements checklist**
Seven rows for OSI Gold requirements:
- Column descriptions
- Sample values
- Join rules
- Grain statements
- Semantic roles
- Golden queries
- Guardrail filters

Each row shows: requirement name, status badge (pending/working/done), progress count (e.g. "12/45 columns"), expand arrow.

Clicking a row expands to show details (which columns have descriptions, which joins were found, etc.).

Listen for `enrich:progress` WebSocket events to update each row's status and counts.

**Bottom panel: Activity log**
Scrolling `<div>` that shows timestamped log entries. Listen for `enrich:log` WebSocket events and append entries.

Add a "Start Enrichment" button that calls `POST /api/pipeline/start` with `targetTier: 'gold'`. Pipeline runs enrich-silver then enrich-gold stages.

On completion, auto-advance to Serve step.

**Step 2: Add CSS**

- `.enrich-dashboard` — two-panel flex layout
- `.enrich-checklist` — top panel
- `.enrich-row` — individual requirement row
- `.enrich-status` — status badge (pending/working/done colors)
- `.activity-log` — bottom panel with overflow-y scroll
- `.log-entry` — individual log line

**Step 3: Commit**

```bash
git add packages/ui/static/setup.js packages/ui/static/setup.css
git commit -m "feat(ui): add Enrich step with requirements checklist and activity log"
```

---

### Task 8: Serve Step (Wizard)

Enhanced completion card showing achieved tier, MCP server start, and publish CTA.

**Files:**
- Modify: `packages/ui/static/setup.js` (add renderServeStep)
- Modify: `packages/ui/static/setup.css` (add serve step styles)

**Step 1: Build renderServeStep**

Enhanced version of the old completion card:
1. Shows achieved tier badge (from `detectAndShowTier`)
2. "Start MCP Server" button — starts the MCP server and shows connection config
3. "Publish to Cloud" button — links to cloud publishing flow
4. CLI command examples in a code block: `context serve`, `context tier`, `context enrich --target gold`
5. If not at Gold, shows what is still missing with "Continue Enrichment" link back to Enrich step

**Step 2: Add CSS**

- `.serve-card` — completion card
- `.serve-commands` — code block for CLI examples
- `.serve-ctas` — button group

**Step 3: Commit**

```bash
git add packages/ui/static/setup.js packages/ui/static/setup.css
git commit -m "feat(ui): add Serve step with MCP server start and publish CTA"
```

---

### Task 9: WebSocket Client in Wizard

Connect the browser wizard to the WebSocket endpoint so it receives real-time updates from the CLI/agent.

**Files:**
- Modify: `packages/ui/static/setup.js` (add WebSocket client initialization)

**Step 1: Add WebSocket client**

At the top of the IIFE, after state initialization, add:

```javascript
var ws = null;
var wsSessionId = null;

function connectWebSocket(sessionId) {
  wsSessionId = sessionId;
  var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(protocol + '//' + location.host + '/ws?session=' + encodeURIComponent(sessionId) + '&role=wizard');

  ws.onmessage = function (evt) {
    try {
      var event = JSON.parse(evt.data);
      handleWsEvent(event);
    } catch (e) { /* ignore */ }
  };

  ws.onclose = function () {
    // Reconnect after 2 seconds
    setTimeout(function () {
      if (wsSessionId) connectWebSocket(wsSessionId);
    }, 2000);
  };
}

function sendWsEvent(type, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: type, sessionId: wsSessionId, payload: payload }));
  }
}

function handleWsEvent(event) {
  switch (event.type) {
    case 'setup:step':
      goToStep(event.payload.step);
      break;
    case 'setup:field':
      var input = document.getElementById(event.payload.fieldId);
      if (input) {
        input.value = event.payload.value;
        input.dispatchEvent(new Event('input'));
      }
      break;
    case 'pipeline:stage':
      // Update stage status in the accordion if visible
      updateStageFromWs(event.payload);
      break;
    case 'enrich:progress':
      updateEnrichProgress(event.payload);
      break;
    case 'enrich:log':
      appendEnrichLog(event.payload);
      break;
  }
}
```

**Step 2: Initialize WebSocket on page load**

On page load, check for a `?session=<id>` query param. If present, connect immediately. Otherwise, create a session via `POST /api/session` and connect.

**Step 3: Send user events back**

When the user edits a field, call `sendWsEvent('user:field', { fieldId, value })`.
When the user clicks Continue, call `sendWsEvent('user:confirm', { step: state.step })`.
When the user clicks Retry, call `sendWsEvent('user:retry', {})`.

**Step 4: Commit**

```bash
git add packages/ui/static/setup.js
git commit -m "feat(ui): add WebSocket client for real-time wizard updates"
```

---

### Task 10: Pipeline Routes WebSocket Integration

Make the pipeline execution emit WebSocket events so the wizard updates in real time instead of only via polling.

**Files:**
- Modify: `packages/ui/src/routes/api/pipeline.ts:228-273` (emit events during executePipeline)

**Step 1: Import setupBus and emit events**

Add import at top of `pipeline.ts`:
```typescript
import { setupBus } from '../events.js';
```

In `executePipeline`, add a `sessionId` parameter. Before each stage runs, emit:
```typescript
setupBus.emitEvent({
  type: 'pipeline:stage',
  sessionId,
  payload: { stage: stage.stage, status: 'running' },
});
```

After each stage completes, emit:
```typescript
setupBus.emitEvent({
  type: 'pipeline:stage',
  sessionId,
  payload: { stage: stage.stage, status: 'done', summary: stage.summary },
});
```

On error, emit with `status: 'error'` and the error message.

**Step 2: Pass sessionId through from API**

In the `POST /api/pipeline/start` handler, read `sessionId` from the request body and pass it to `executePipeline`.

**Step 3: Commit**

```bash
git add packages/ui/src/routes/api/pipeline.ts
git commit -m "feat(ui): emit WebSocket events during pipeline execution"
```

---

### Task 11: Build and Verify

Build all packages, start the UI server, and verify the unified setup flow works end-to-end.

**Files:**
- No new files

**Step 1: Build packages**

Run: `cd /Users/erickittelson/Code/RunContext/runcontext && pnpm --filter=@runcontext/cli build && pnpm --filter=@runcontext/ui build`

**Step 2: Start the UI server**

Run: `node packages/cli/dist/index.js setup --no-browser`

**Step 3: Verify in browser**

Open `http://localhost:4040/setup` and verify:
1. Connect step shows auto-detected sources and platform picker
2. Define step shows merged product/owner form
3. Scaffold step runs Bronze pipeline with accordion
4. Checkpoint shows tier scorecard with two CTAs
5. Enrich step shows requirements checklist and activity log
6. Serve step shows completion card with MCP server start

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat: unified setup flow with WebSocket bridge and enrichment dashboard"
```
