# Context Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `--studio` flag to `context dev` that serves an interactive web UI for editing semantic layer metadata, with save-back to YAML and live tier updates.

**Architecture:** Extend `@runcontext/site` with a `studioMode` flag that injects edit affordances into existing EJS templates. Add an HTTP server to `context dev` (Node built-in `http` module) with 4 API routes. Client-side is vanilla JS — no framework. File watcher pushes updates via SSE.

**Tech Stack:** Node `http` module, EJS templates, vanilla JS, `yaml` npm package for comment-preserving YAML round-trip, `chokidar` for file watching, SSE for live updates.

---

### Task 1: YAML Round-Trip Utility

Create a utility that reads a YAML string, applies a change at a dot-path, and returns the modified YAML string — preserving comments and formatting.

**Files:**
- Create: `packages/core/src/yaml-edit.ts`
- Test: `packages/core/src/__tests__/yaml-edit.test.ts`
- Modify: `packages/core/src/index.ts` (add export)

**Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/yaml-edit.test.ts
import { describe, it, expect } from 'vitest';
import { applyYamlEdit, previewYamlEdit } from '../yaml-edit.js';

describe('applyYamlEdit', () => {
  it('sets a scalar value at a dot-path', () => {
    const input = `name: orders\ndescription: Old description\n`;
    const result = applyYamlEdit(input, 'description', 'New description');
    expect(result).toContain('description: New description');
    expect(result).toContain('name: orders');
  });

  it('sets a nested value at a dot-path', () => {
    const input = `governance:\n  trust: draft\n  tags:\n    - analytics\n`;
    const result = applyYamlEdit(input, 'governance.trust', 'endorsed');
    expect(result).toContain('trust: endorsed');
    expect(result).toContain('tags:');
  });

  it('sets a value in an array by index', () => {
    const input = `datasets:\n  - name: orders\n    description: Old\n  - name: users\n    description: Also old\n`;
    const result = applyYamlEdit(input, 'datasets.0.description', 'New');
    expect(result).toContain('description: New');
    expect(result).toContain('name: users');
  });

  it('preserves YAML comments', () => {
    const input = `# Important comment\nname: orders\ndescription: Old\n`;
    const result = applyYamlEdit(input, 'description', 'New');
    expect(result).toContain('# Important comment');
  });

  it('adds a new key if path does not exist', () => {
    const input = `name: orders\n`;
    const result = applyYamlEdit(input, 'description', 'Brand new');
    expect(result).toContain('description: Brand new');
  });
});

describe('previewYamlEdit', () => {
  it('returns before and after without modifying input', () => {
    const input = `name: orders\ndescription: Old\n`;
    const preview = previewYamlEdit(input, 'description', 'New');
    expect(preview.before).toBe(input);
    expect(preview.after).toContain('description: New');
    expect(preview.changed).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/__tests__/yaml-edit.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/yaml-edit.ts
import { parseDocument } from 'yaml';

/**
 * Apply an edit to a YAML string at a dot-separated path.
 * Preserves comments and formatting via yaml library's document model.
 */
export function applyYamlEdit(
  yamlContent: string,
  dotPath: string,
  value: unknown,
): string {
  const doc = parseDocument(yamlContent);
  const segments = dotPath.split('.');
  setNestedValue(doc, segments, value);
  return doc.toString();
}

/**
 * Preview an edit without writing — returns before/after strings.
 */
export function previewYamlEdit(
  yamlContent: string,
  dotPath: string,
  value: unknown,
): { before: string; after: string; changed: boolean } {
  const after = applyYamlEdit(yamlContent, dotPath, value);
  return { before: yamlContent, after, changed: yamlContent !== after };
}

function setNestedValue(doc: ReturnType<typeof parseDocument>, segments: string[], value: unknown): void {
  let current: any = doc.contents;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const idx = Number(seg);
    if (!isNaN(idx) && current?.items) {
      current = current.items[idx]?.value ?? current.items[idx];
    } else if (current?.get) {
      current = current.get(seg, true);
    } else {
      return;
    }
  }
  const lastSeg = segments[segments.length - 1];
  if (current?.set) {
    current.set(lastSeg, value);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/__tests__/yaml-edit.test.ts`
Expected: PASS

**Step 5: Export from core index**

Add to `packages/core/src/index.ts`:
```typescript
export { applyYamlEdit, previewYamlEdit } from './yaml-edit.js';
```

**Step 6: Commit**

```bash
git add packages/core/src/yaml-edit.ts packages/core/src/__tests__/yaml-edit.test.ts packages/core/src/index.ts
git commit -m "feat(core): add YAML round-trip edit utility for context studio"
```

---

### Task 2: Studio Server

Create the HTTP server module that serves the site and exposes the save/preview/events API. This is a standalone module used by `dev.ts`.

**Files:**
- Create: `packages/cli/src/studio/server.ts`
- Create: `packages/cli/src/studio/sse.ts`
- Test: `packages/cli/src/__tests__/studio-server.test.ts`

**Step 1: Write the SSE manager**

```typescript
// packages/cli/src/studio/sse.ts
import type { ServerResponse } from 'node:http';

export class SSEManager {
  private clients: Set<ServerResponse> = new Set();

  addClient(res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('data: {"type":"connected"}\n\n');
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.write(payload);
    }
  }
}
```

**Step 2: Write the studio server**

```typescript
// packages/cli/src/studio/server.ts
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  compile,
  loadConfig,
  emitManifest,
  LintEngine,
  ALL_RULES,
  applyYamlEdit,
  previewYamlEdit,
  type Manifest,
  type Diagnostic,
} from '@runcontext/core';
import { SSEManager } from './sse.js';

export interface StudioServerOptions {
  contextDir: string;
  rootDir: string;
  port: number;
  host: string;
}

export async function startStudioServer(opts: StudioServerOptions): Promise<{
  server: http.Server;
  sse: SSEManager;
  recompileAndBroadcast: () => Promise<void>;
}> {
  const { contextDir, rootDir, port, host } = opts;
  const config = loadConfig(rootDir);
  const sse = new SSEManager();

  let cachedPages: Map<string, string> | null = null;
  let cachedManifest: Manifest | null = null;

  async function recompile(): Promise<{ manifest: Manifest; diagnostics: Diagnostic[] }> {
    const { graph, diagnostics: compileDiags } = await compile({ contextDir, config, rootDir });
    const engine = new LintEngine();
    for (const rule of ALL_RULES) engine.register(rule);
    const lintDiags = engine.run(graph);
    const manifest = emitManifest(graph, config);
    cachedManifest = manifest;
    cachedPages = null; // invalidate
    return { manifest, diagnostics: [...compileDiags, ...lintDiags] };
  }

  async function recompileAndBroadcast(): Promise<void> {
    const { manifest, diagnostics } = await recompile();
    sse.broadcast('update', {
      tiers: manifest.tiers,
      diagnosticCount: diagnostics.length,
      diagnostics: diagnostics.slice(0, 50), // cap for bandwidth
    });
  }

  async function getPages(): Promise<Map<string, string>> {
    if (cachedPages) return cachedPages;
    if (!cachedManifest) await recompile();
    const { generateSite } = await import('@runcontext/site');
    cachedPages = generateSite(cachedManifest!, { ...config.site, studioMode: true });
    return cachedPages;
  }

  // Initial compile
  await recompile();

  function parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Invalid JSON')); }
      });
      req.on('error', reject);
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    try {
      // --- API routes ---
      if (url.pathname === '/api/events' && req.method === 'GET') {
        sse.addClient(res);
        return;
      }

      if (url.pathname === '/api/manifest' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cachedManifest));
        return;
      }

      if (url.pathname === '/api/preview' && req.method === 'POST') {
        const { file, path: dotPath, value } = await parseBody(req);
        const filePath = path.resolve(rootDir, file);
        if (!filePath.startsWith(path.resolve(rootDir))) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const preview = previewYamlEdit(content, dotPath, value);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ filename: file, ...preview }));
        return;
      }

      if (url.pathname === '/api/save' && req.method === 'POST') {
        const { edits } = await parseBody(req);
        const results: Array<{ file: string; ok: boolean }> = [];
        for (const edit of edits) {
          const filePath = path.resolve(rootDir, edit.file);
          if (!filePath.startsWith(path.resolve(rootDir))) {
            results.push({ file: edit.file, ok: false });
            continue;
          }
          const content = fs.readFileSync(filePath, 'utf-8');
          const updated = applyYamlEdit(content, edit.path, edit.value);
          fs.writeFileSync(filePath, updated, 'utf-8');
          results.push({ file: edit.file, ok: true });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results }));
        return;
      }

      // --- Static site pages ---
      const pages = await getPages();
      let pagePath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
      if (!pagePath.endsWith('.html') && !pagePath.endsWith('.json')) {
        pagePath += '.html';
      }
      const page = pages.get(pagePath);
      if (page) {
        const ct = pagePath.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8';
        res.writeHead(200, { 'Content-Type': ct });
        res.end(page);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end((err as Error).message);
    }
  });

  server.listen(port, host);

  return { server, sse, recompileAndBroadcast };
}
```

**Step 3: Write a basic test**

```typescript
// packages/cli/src/__tests__/studio-server.test.ts
import { describe, it, expect } from 'vitest';

describe('studio server', () => {
  it('module exports startStudioServer', async () => {
    const mod = await import('../studio/server.js');
    expect(typeof mod.startStudioServer).toBe('function');
  });
});
```

**Step 4: Run tests**

Run: `cd packages/cli && npx vitest run src/__tests__/studio-server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/studio/
git commit -m "feat(cli): add studio HTTP server with save/preview/SSE APIs"
```

---

### Task 3: Wire Studio into `context dev`

Add `--studio`, `--port`, and `--host` flags to the dev command. When `--studio` is passed, start the studio server alongside the file watcher.

**Files:**
- Modify: `packages/cli/src/commands/dev.ts`

**Step 1: Add flags and server startup**

Add to the `devCommand` chain (after `.option('--fix', ...)`):
```typescript
.option('--studio', 'Open interactive metadata editor in the browser')
.option('--port <number>', 'Studio server port (default: 4040)', '4040')
.option('--host <address>', 'Studio server host (default: localhost)', 'localhost')
```

In the action handler, after the initial lint run, add:
```typescript
if (opts.studio) {
  const { startStudioServer } = await import('../studio/server.js');
  const studioPort = parseInt(opts.port, 10);
  const { server: studioServer, recompileAndBroadcast } = await startStudioServer({
    contextDir,
    rootDir: process.cwd(),
    port: studioPort,
    host: opts.host,
  });
  const studioUrl = `http://${opts.host === '0.0.0.0' ? 'localhost' : opts.host}:${studioPort}`;
  console.log(chalk.green(`\n  Studio running at ${chalk.bold(studioUrl)}\n`));

  // Open browser safely using execFile (no shell injection)
  const { execFile } = await import('node:child_process');
  const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const openArgs = process.platform === 'win32' ? ['/c', 'start', studioUrl] : [studioUrl];
  execFile(openCmd, openArgs, (err) => {
    if (err) console.log(chalk.gray(`  Open ${studioUrl} in your browser`));
  });

  // Wire watcher to also broadcast via SSE
  // (modify the existing chokidar on('all') to also call recompileAndBroadcast)
}
```

Update the existing chokidar `on('all')` callback to also trigger `recompileAndBroadcast()` when studio is active.

**Step 2: Test manually**

Run: `cd /path/to/test-project && context dev --studio`
Expected: Browser opens with the metadata catalog site.

**Step 3: Commit**

```bash
git add packages/cli/src/commands/dev.ts
git commit -m "feat(cli): add --studio flag to context dev for interactive editing"
```

---

### Task 4: Studio Mode Templates — Shared Infrastructure

Add the studio-mode client JS, staged changes bar, and save modal to the shared template.

**Files:**
- Modify: `packages/site/src/templates/shared.ts`
- Modify: `packages/site/src/generator.ts`

**Step 1: Add `studioMode` to generator and thread through**

In `packages/site/src/generator.ts`, update `generateSite()`:
```typescript
export function generateSite(
  manifest: Manifest,
  config?: SiteConfig & { studioMode?: boolean },
): Map<string, string> {
  const studioMode = config?.studioMode ?? false;
  const commonData = {
    siteTitle,
    basePath,
    models: manifest.models,
    tiers: manifest.tiers,
    studioMode,
  };
  // ... rest unchanged, studioMode flows to all ejs.render calls via commonData
}
```

**Step 2: Add studio CSS to `shared.ts`**

New export `STUDIO_CSS` with styles for: `.edit-btn`, `.editable`, `.editable:hover`, `.staged-bar`, `.diff-modal`, `.diff-modal-content`, `.diff-file`, `.diff-add`, `.diff-del`, `.staged-btn`, `.toast`.

**Step 3: Add studio JS to `shared.ts`**

New export `STUDIO_SCRIPTS` — vanilla JS for:
- `window.studioState = { edits: [] }` — tracks staged edits
- `stageEdit(file, path, value, displayLabel)` — adds to staged list, updates count bar
- `discardEdits()` — clears all staged edits
- `previewAndSave()` — POSTs to `/api/preview` for each unique file, renders diffs in modal
- `confirmSave()` — POSTs to `/api/save`, clears state, shows toast
- `initSSE()` — connects to `/api/events`, on `update` event refreshes scorecard and shows toast
- `makeEditable(el)` — reads `data-file`/`data-path` attrs, makes element contenteditable, stages on blur
- `makeDropdown(el)` — reads `data-options` attr, shows dropdown, stages on selection

**Step 4: Add `STAGED_BAR` and `DIFF_MODAL` template strings**

`STAGED_BAR`:
```html
<div class="staged-bar" id="staged-bar" style="display:none;">
  <span id="staged-count">0 changes staged</span>
  <button onclick="previewAndSave()" class="staged-btn primary">Preview & Save</button>
  <button onclick="discardEdits()" class="staged-btn secondary">Discard</button>
</div>
```

`DIFF_MODAL`:
```html
<div class="diff-modal" id="diff-modal" style="display:none;">
  <div class="diff-modal-content">
    <h2>Review Changes</h2>
    <div id="diff-container"></div>
    <div class="diff-actions">
      <button onclick="confirmSave()" class="staged-btn primary">Save All</button>
      <button onclick="closeDiffModal()" class="staged-btn secondary">Cancel</button>
    </div>
  </div>
</div>
```

**Step 5: Inject conditionally**

In `HEAD`, after existing `</style>`:
```ejs
<% if (typeof studioMode !== 'undefined' && studioMode) { %>
<style>/* STUDIO_CSS content */</style>
<% } %>
```

Before closing `</body>`, after `SCRIPTS`:
```ejs
<% if (typeof studioMode !== 'undefined' && studioMode) { %>
<%- STAGED_BAR %>
<%- DIFF_MODAL %>
<script>/* STUDIO_SCRIPTS content */</script>
<% } %>
```

**Step 6: Commit**

```bash
git add packages/site/src/templates/shared.ts packages/site/src/generator.ts
git commit -m "feat(site): add studio mode infrastructure — CSS, JS, staged bar, diff modal"
```

---

### Task 5: Studio Mode — Schema Page Editing

Make the schema browser editable: field descriptions (inline text), semantic roles (dropdown), aggregation (dropdown), additive (toggle).

**Files:**
- Modify: `packages/site/src/templates/schema.ts`

**Step 1: Add edit affordances to field rows**

In the `<tbody>` loop, wrap each editable cell with a studio-mode conditional using `data-file`, `data-path`, and `data-options` attributes. The `makeEditable()` and `makeDropdown()` functions from Task 4 handle the interaction.

- Field description → `makeEditable`, path: `semantic_model.0.datasets.<i>.fields.<j>.description`, file: `context/models/<name>.osi.yaml`
- Semantic role → `makeDropdown`, options: `identifier,metric,dimension,date,attribute`, file: `context/governance/<name>.governance.yaml`, path: `datasets.<dsName>.fields.<fieldKey>.semantic_role`
- Aggregation → `makeDropdown`, options: `SUM,AVG,COUNT,MIN,MAX,NONE`, path: `...default_aggregation`
- Additive → toggle button, path: `...additive`

**Step 2: Add edit affordance to dataset description**

Same pattern — inline text edit for `ds.description`.

**Step 3: Commit**

```bash
git add packages/site/src/templates/schema.ts
git commit -m "feat(site): make schema page fields editable in studio mode"
```

---

### Task 6: Studio Mode — Model Page Editing

Make the model overview editable: descriptions, governance, golden queries, guardrails, lineage.

**Files:**
- Modify: `packages/site/src/templates/model.ts`

**Step 1: Model-level fields**

- Model description → inline text → `context/models/<name>.osi.yaml` at `semantic_model.0.description`
- AI context → inline text (multi-line) → `semantic_model.0.ai_context`
- Trust → dropdown → `context/governance/<name>.governance.yaml` at `trust`
- Refresh → inline text → governance at `refresh`

**Step 2: Add/edit golden queries**

"Add Golden Query" button renders an empty card form: question (text input), SQL (textarea), description (text input). On fill + "Stage", calls `stageEdit` targeting `context/rules/<name>.rules.yaml`.

**Step 3: Add/edit guardrails**

Same card pattern: name, filter expression, reason.

**Step 4: Lineage editing**

"Add Upstream Source" / "Add Downstream Target" buttons with source/target name, type dropdown (pipeline/dashboard/api/file/derived), notes text input.

**Step 5: Commit**

```bash
git add packages/site/src/templates/model.ts
git commit -m "feat(site): make model page editable in studio mode"
```

---

### Task 7: Studio Mode — Glossary & Owner Editing

**Files:**
- Modify: `packages/site/src/templates/glossary.ts`
- Modify: `packages/site/src/templates/owner.ts`

**Step 1: Glossary**

- Definition → inline text → `context/glossary/<id>.term.yaml` at `definition`
- Synonyms → comma-separated text input → `synonyms`
- "Add Term" button → card form with id, definition, synonyms, tags

**Step 2: Owners**

- Display name, email → inline text → `context/owners/<id>.owner.yaml`

**Step 3: Commit**

```bash
git add packages/site/src/templates/glossary.ts packages/site/src/templates/owner.ts
git commit -m "feat(site): make glossary and owner pages editable in studio mode"
```

---

### Task 8: SSE-Driven Live Updates

Wire file watcher broadcasts and client-side scorecard updates.

**Files:**
- Modify: `packages/cli/src/commands/dev.ts`
- Modify: `packages/site/src/templates/shared.ts` (SSE client in STUDIO_SCRIPTS)

**Step 1: Wire watcher to broadcast**

In `dev.ts`, when `--studio` is active, the chokidar `on('all')` callback calls `recompileAndBroadcast()` (returned from `startStudioServer` in Task 3).

**Step 2: Client-side SSE handler**

In `STUDIO_SCRIPTS`, the `initSSE()` function (called on page load when `studioMode`):
- Connects to `/api/events`
- On `update` event, updates `.sc-status` badges and `.check-icon` elements
- Shows a toast: "Tier updated: Bronze → Silver" or "3 lint issues resolved"
- Refreshes page content if tier changed (simple `location.reload()` for v1)

**Step 3: Commit**

```bash
git add packages/cli/src/commands/dev.ts packages/site/src/templates/shared.ts
git commit -m "feat: live tier scorecard and lint updates via SSE in studio mode"
```

---

### Task 9: Documentation

**Files:**
- Modify: `docs-site/src/content/docs/cli/dev.mdx`
- Modify: `docs-site/src/content/docs/getting-started/quick-start.mdx`
- Modify: `docs-site/src/content/docs/getting-started/introduction.mdx`

**Step 1: Update dev.mdx**

Add `--studio`, `--port`, `--host` to options table. Add "Studio Mode" section describing: what it does, how to launch, the editing workflow, the save flow with diff preview.

**Step 2: Update quick-start.mdx**

Add step: "Open the visual editor with `context dev --studio` to curate metadata in your browser."

**Step 3: Update introduction.mdx**

Add to features: "Visual metadata editor — curate descriptions, semantic roles, and business rules in an interactive browser UI that saves back to YAML"

**Step 4: Build docs**

Run: `cd docs-site && npm run build`
Expected: 30+ pages, no errors

**Step 5: Commit**

```bash
git add docs-site/
git commit -m "docs: add context studio documentation"
```

---

### Task 10: Integration Test

**Files:**
- Create: `packages/cli/src/__tests__/studio-integration.test.ts`

**Step 1: Write integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('studio integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-test-'));
    fs.mkdirSync(path.join(tmpDir, 'context', 'models'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'context', 'governance'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'context', 'owners'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'contextkit.config.yaml'),
      'context_dir: context\noutput_dir: dist\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'context', 'models', 'test.osi.yaml'),
      'version: "1.0"\nsemantic_model:\n  - name: test\n    description: Old description\n    datasets: []\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'context', 'governance', 'test.governance.yaml'),
      'model: test\nowner: test-owner\ndescription: Gov desc\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'context', 'owners', 'test-owner.owner.yaml'),
      'id: test-owner\ndisplay_name: Test\nemail: test@test.com\n',
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('round-trips YAML edits preserving structure', async () => {
    const { applyYamlEdit } = await import('@runcontext/core');
    const filePath = path.join(tmpDir, 'context', 'models', 'test.osi.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const updated = applyYamlEdit(content, 'semantic_model.0.description', 'New description');
    fs.writeFileSync(filePath, updated, 'utf-8');
    const verify = fs.readFileSync(filePath, 'utf-8');
    expect(verify).toContain('New description');
    expect(verify).toContain('version:');
    expect(verify).toContain('semantic_model:');
  });
});
```

**Step 2: Run test**

Run: `cd packages/cli && npx vitest run src/__tests__/studio-integration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/cli/src/__tests__/studio-integration.test.ts
git commit -m "test: add studio integration test"
```

---

## Execution Order

Tasks 1-3 are the foundation (YAML utility → server → CLI wiring). Tasks 4-7 are the template changes (can be parallelized). Task 8 wires up live updates. Task 9 is docs. Task 10 is the integration test.

```
Task 1 (YAML edit) → Task 2 (Server) → Task 3 (CLI wiring)
                                              ↓
                           ┌─────────────────┬┴────────────┐
                        Task 4            Task 5         Task 6-7
                     (shared infra)    (schema edit)  (model/glossary)
                           └─────────────────┴─────────────┘
                                              ↓
                                         Task 8 (SSE)
                                              ↓
                                      Task 9-10 (docs/test)
```
