/**
 * E2E Playwright tests for the RunContext Setup Wizard UI.
 *
 * Flow tested:
 *   Step 1 – Connect   (provider grid, manual connection fallback)
 *   Step 2 – Define    (product name + description form)
 *   Step 3 – Scaffold  (build button + pipeline status polling)
 *   Step 4 – Checkpoint (tier scorecard)
 *
 * The server is spawned in beforeAll using execFile (safe, no shell injection).
 * OAuth flows (Neon, Supabase, …) require real credentials and are not tested
 * here. The Define and Scaffold steps are tested by injecting wizard state
 * via sessionStorage (matching the app's own persistence mechanism).
 */

import { test, expect, type Page } from '@playwright/test';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as http from 'node:http';
import { fileURLToPath } from 'node:url';
import type { ChildProcess } from 'node:child_process';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFile = promisify(execFileCallback);

// ---------------------------------------------------------------------------
// Server lifecycle helpers
// ---------------------------------------------------------------------------

const SERVER_PORT = 4055;
const BASE_URL = `http://localhost:${SERVER_PORT}`;

let serverProcess: ChildProcess | null = null;
let tmpDir: string;

/** Poll the health endpoint until the server is ready or timeout expires. */
function waitForServer(url: string, timeoutMs = 20_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function attempt() {
      http
        .get(`${url}/api/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
          res.resume();
        })
        .on('error', retry);
    }
    function retry() {
      if (Date.now() > deadline) {
        reject(new Error(`Server did not start within ${timeoutMs}ms`));
        return;
      }
      setTimeout(attempt, 200);
    }
    attempt();
  });
}

// ---------------------------------------------------------------------------
// Suite setup / teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  // Create an isolated project directory for the server
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-e2e-'));

  // Kill anything already on the port (best-effort)
  try {
    await execFile('bash', ['-c', `lsof -ti:${SERVER_PORT} | xargs kill 2>/dev/null || true`]);
  } catch { /* ignore */ }

  const cliEntry = path.resolve(
    __dirname,
    '..', '..', '..', 'cli', 'dist', 'index.js',
  );

  if (!fs.existsSync(cliEntry)) {
    throw new Error(`CLI entry not found at: ${cliEntry}. Run \`pnpm -r build\` first.`);
  }

  const { spawn } = await import('node:child_process');
  serverProcess = spawn(process.execPath, [cliEntry, 'setup', '--port', String(SERVER_PORT)], {
    cwd: tmpDir,
    stdio: 'pipe',
  });

  await waitForServer(BASE_URL, 20_000);
});

test.afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToSetup(page: Page) {
  await page.goto(`${BASE_URL}/setup`);
  await page.waitForSelector('#stepper', { timeout: 10_000 });
  await page.waitForSelector('#wizard-content', { timeout: 10_000 });
}

/** Inject wizard state into sessionStorage and reload the page. */
async function setWizardState(page: Page, state: Record<string, unknown>) {
  await navigateToSetup(page);
  await page.evaluate((s) => {
    sessionStorage.setItem('runcontext_wizard_state', JSON.stringify(s));
  }, state);
  await page.reload();
  await page.waitForSelector('#wizard-content', { timeout: 8_000 });
}

const CONNECTED_SOURCE = { name: 'test-db', adapter: 'postgres', origin: 'config:test', status: 'detected' };
const FILLED_BRIEF = {
  product_name: 'e2e-test-product',
  description: 'E2E test product',
  owner: { name: 'Tester', team: 'QA', email: 'qa@example.com' },
  sensitivity: 'internal',
  docs: [],
};

// ---------------------------------------------------------------------------
// STEP 1 — Connect
// ---------------------------------------------------------------------------

test.describe('Step 1: Connect', () => {
  test('wizard page loads with RunContext branding', async ({ page }) => {
    await page.goto(`${BASE_URL}/setup`);
    await expect(page).toHaveTitle(/RunContext/);
    await expect(page.locator('.brand-run')).toBeVisible();
    await expect(page.locator('.brand-context')).toBeVisible();
  });

  test('stepper renders all 6 step labels', async ({ page }) => {
    await navigateToSetup(page);

    const stepper = page.locator('#stepper');
    await expect(stepper).toBeVisible();

    const labels = ['Connect', 'Define', 'Scaffold', 'Checkpoint', 'Enrich', 'Serve'];
    for (const label of labels) {
      await expect(stepper.getByText(label)).toBeVisible();
    }

    await expect(stepper.locator('.step-active')).toHaveText('Connect');
  });

  test('Connect step renders heading and provider grid', async ({ page }) => {
    await navigateToSetup(page);

    // Wait for providers to finish loading (loading message is replaced)
    await page.waitForFunction(
      () => document.querySelector('.connect-providers, .platform-grid') !== null,
      { timeout: 10_000 },
    );

    await expect(page.getByRole('heading', { name: /Connect Your Database/i })).toBeVisible();
    await expect(page.locator('#connect-url')).toBeVisible();
  });

  test('Neon provider is listed (as detected card or platform button)', async ({ page }) => {
    await navigateToSetup(page);

    // Wait for providers to load — either as a detected source-card or platform-btn
    await page.waitForFunction(
      () =>
        document.querySelector('.connect-providers') !== null ||
        document.querySelector('.platform-grid') !== null,
      { timeout: 10_000 },
    );

    // Neon may appear either:
    //  a) as a detected source card (.source-card-detected) with a "Connect via OAuth" button
    //  b) as a plain platform button under "Other providers"
    // Either way, the text "Neon" should be visible somewhere in the providers section.
    await expect(
      page.locator('.connect-providers, .platform-grid, .source-cards')
        .getByText(/Neon/i)
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('clicking an OAuth provider button shows connecting message', async ({ page }) => {
    await navigateToSetup(page);

    // Wait for provider UI to fully render
    await page.waitForFunction(
      () =>
        document.querySelector('.connect-providers') !== null ||
        document.querySelector('.platform-grid') !== null,
      { timeout: 10_000 },
    );

    // Click only an OAuth button (either "Connect via OAuth" in a detected card,
    // or a platform-btn in the "Other providers" grid). Avoid "Use This" buttons
    // on local-file cards which navigate directly to Define instead of showing
    // the OAuth spinner.
    const oauthBtn = page
      .locator('.source-card-detected .btn, .platform-btn')
      .first();

    await oauthBtn.click();

    await page.waitForFunction(
      () => {
        const el = document.getElementById('connect-oauth-result');
        return el !== null && el.textContent !== null && el.textContent.includes('Connecting');
      },
      { timeout: 8_000 },
    );
  });

  test('manual connection string is accepted and advances to Define', async ({ page }) => {
    // The POST /api/sources endpoint stores any connection string without
    // validation (validation happens later during introspect). So a "valid"
    // URL prefix string should be accepted and advance the wizard to Define.
    await navigateToSetup(page);

    await page.locator('#connect-url').fill('postgres://localhost/mydb');
    await page.locator('.manual-connect .btn-primary').click();

    // After a successful manual connection the wizard advances to step 2 (Define)
    await page.waitForSelector('#product_name', { timeout: 10_000 });
    await expect(page.locator('#stepper .step-active')).toHaveText('Define');
  });
});

// ---------------------------------------------------------------------------
// STEP 2 — Define
// ---------------------------------------------------------------------------

test.describe('Step 2: Define', () => {
  async function advanceToDefine(page: Page) {
    await setWizardState(page, {
      step: 2,
      brief: {
        product_name: '',
        description: '',
        owner: { name: '', team: '', email: '' },
        sensitivity: 'internal',
        docs: [],
      },
      sources: [CONNECTED_SOURCE],
      pipelineId: null,
    });
    await page.waitForSelector('#product_name', { timeout: 8_000 });
  }

  test('Define step renders all form fields', async ({ page }) => {
    await advanceToDefine(page);

    await expect(page.locator('#product_name')).toBeVisible();
    await expect(page.locator('#description')).toBeVisible();
    await expect(page.locator('#owner_name')).toBeVisible();
    await expect(page.locator('#owner_team')).toBeVisible();
    await expect(page.locator('#owner_email')).toBeVisible();
    await expect(page.locator('#sensitivity')).toBeVisible();
  });

  test('stepper shows Define as active', async ({ page }) => {
    await advanceToDefine(page);
    await expect(page.locator('#stepper .step-active')).toHaveText('Define');
  });

  test('submitting empty form shows validation errors', async ({ page }) => {
    await advanceToDefine(page);

    // Block the suggest-brief API so it cannot auto-fill the form
    await page.route('**/api/suggest-brief', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    );

    // Clear any values that might have been pre-filled before the route was set
    await page.locator('#product_name').fill('');
    await page.locator('#description').fill('');

    await page.locator('.define-actions .btn-primary').click();
    await expect(page.locator('.field-error').first()).toBeVisible({ timeout: 4_000 });
  });

  test('invalid product name (spaces/symbols) shows error', async ({ page }) => {
    await advanceToDefine(page);

    await page.locator('#product_name').fill('bad name!@#');
    await page.locator('#description').fill('A valid description');
    await page.locator('.define-actions .btn-primary').click();

    await expect(page.locator('.field-error').first()).toBeVisible({ timeout: 4_000 });
    const text = await page.locator('.field-error').first().textContent();
    expect(text).toMatch(/only letters|alphanumeric/i);
  });

  test('valid form submission advances to Scaffold step', async ({ page }) => {
    await advanceToDefine(page);

    await page.locator('#product_name').fill('test-product');
    await page.locator('#description').fill('A test data product for E2E testing');
    await page.locator('#owner_name').fill('Test User');
    await page.locator('#owner_team').fill('Engineering');
    await page.locator('#owner_email').fill('test@example.com');
    await page.locator('.define-actions .btn-primary').click();

    await page.waitForSelector('#scaffold-stages', { timeout: 10_000 });
    await expect(page.locator('#stepper .step-active')).toHaveText('Scaffold');
  });
});

// ---------------------------------------------------------------------------
// STEP 3 — Scaffold
// ---------------------------------------------------------------------------

test.describe('Step 3: Scaffold', () => {
  async function advanceToScaffold(page: Page) {
    await setWizardState(page, {
      step: 3,
      brief: FILLED_BRIEF,
      sources: [CONNECTED_SOURCE],
      pipelineId: null,
    });
    await page.waitForSelector('#scaffold-stages', { timeout: 8_000 });
  }

  test('Scaffold step renders all stage rows', async ({ page }) => {
    await advanceToScaffold(page);

    for (const stage of ['introspect', 'scaffold', 'verify', 'autofix', 'agent-instructions']) {
      await expect(page.locator(`[data-stage="${stage}"]`)).toBeVisible();
    }
  });

  test('stepper shows Scaffold as active', async ({ page }) => {
    await advanceToScaffold(page);
    await expect(page.locator('#stepper .step-active')).toHaveText('Scaffold');
  });

  test('"Start Build" button is visible and enabled', async ({ page }) => {
    await advanceToScaffold(page);
    const btn = page.locator('#scaffold-start-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('clicking Start Build calls pipeline/start API', async ({ page }) => {
    await advanceToScaffold(page);

    let startCalled = false;
    await page.route('**/api/pipeline/start', async (route) => {
      startCalled = true;
      await route.continue();
    });

    await page.locator('#scaffold-start-btn').click();

    // Button should change state after click
    await page.waitForFunction(() => {
      const btn = document.getElementById('scaffold-start-btn');
      return !btn || btn.hasAttribute('disabled') || btn.textContent !== 'Start Build';
    }, { timeout: 5_000 });

    expect(startCalled).toBe(true);
  });

  test('pipeline status polling updates stage dot classes', async ({ page }) => {
    await advanceToScaffold(page);

    const pipelineId = 'e2e-polling-test';

    await page.route('**/api/pipeline/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: pipelineId, status: 'running' }),
      });
    });

    let pollCount = 0;
    await page.route(`**/api/pipeline/status/${pipelineId}`, async (route) => {
      pollCount++;
      const stages =
        pollCount < 2
          ? [
              { name: 'introspect', status: 'running' },
              { name: 'scaffold', status: 'pending' },
              { name: 'verify', status: 'pending' },
              { name: 'autofix', status: 'pending' },
              { name: 'agent-instructions', status: 'pending' },
            ]
          : [
              { name: 'introspect', status: 'done', summary: 'Found 3 tables' },
              { name: 'scaffold', status: 'running' },
              { name: 'verify', status: 'pending' },
              { name: 'autofix', status: 'pending' },
              { name: 'agent-instructions', status: 'pending' },
            ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: pipelineId, status: 'running', stages }),
      });
    });

    await page.locator('#scaffold-start-btn').click();

    await page.waitForFunction(() => {
      const row = document.getElementById('stage-introspect');
      if (!row) return false;
      const dot = row.querySelector('.stage-dot');
      return dot !== null && dot.classList.contains('done');
    }, { timeout: 10_000 });

    await page.waitForFunction(() => {
      const row = document.getElementById('stage-scaffold');
      if (!row) return false;
      const dot = row.querySelector('.stage-dot');
      return dot !== null && dot.classList.contains('running');
    }, { timeout: 10_000 });
  });

  test('fully completed pipeline advances to Checkpoint', async ({ page }) => {
    await advanceToScaffold(page);

    const pipelineId = 'e2e-complete-pipeline';

    await page.route('**/api/pipeline/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: pipelineId, status: 'running' }),
      });
    });

    const allDone = [
      { name: 'introspect', status: 'done', summary: '3 tables found' },
      { name: 'scaffold', status: 'done', summary: 'Files written' },
      { name: 'enrich-silver', status: 'skipped' },
      { name: 'enrich-gold', status: 'skipped' },
      { name: 'verify', status: 'done', summary: 'No issues' },
      { name: 'autofix', status: 'done', summary: 'No fixes needed' },
      { name: 'agent-instructions', status: 'done', summary: 'Instructions written' },
    ];

    await page.route(`**/api/pipeline/status/${pipelineId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: pipelineId, status: 'done', stages: allDone }),
      });
    });

    await page.locator('#scaffold-start-btn').click();

    await page.waitForSelector('.checkpoint-card', { timeout: 10_000 });
    await expect(page.locator('#stepper .step-active')).toHaveText('Checkpoint');
  });

  test('pipeline error shows error message and Retry button', async ({ page }) => {
    await advanceToScaffold(page);

    const pipelineId = 'e2e-error-pipeline';

    await page.route('**/api/pipeline/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: pipelineId, status: 'running' }),
      });
    });

    await page.route(`**/api/pipeline/status/${pipelineId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: pipelineId,
          status: 'error',
          error: 'Database connection refused',
          stages: [
            { name: 'introspect', status: 'error', error: 'Connection refused' },
            { name: 'scaffold', status: 'pending' },
            { name: 'verify', status: 'pending' },
            { name: 'autofix', status: 'pending' },
            { name: 'agent-instructions', status: 'pending' },
          ],
        }),
      });
    });

    await page.locator('#scaffold-start-btn').click();

    await expect(page.locator('#scaffold-error .field-error')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#scaffold-actions .btn-primary')).toHaveText('Retry', { timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// STEP 4 — Checkpoint
// ---------------------------------------------------------------------------

test.describe('Step 4: Checkpoint', () => {
  async function advanceToCheckpoint(page: Page) {
    await setWizardState(page, {
      step: 4,
      brief: FILLED_BRIEF,
      sources: [CONNECTED_SOURCE],
      pipelineId: 'completed-pipeline-id',
    });
    await page.waitForSelector('.checkpoint-card', { timeout: 8_000 });
  }

  test('Checkpoint step shows "Bronze Tier Achieved"', async ({ page }) => {
    await advanceToCheckpoint(page);
    await expect(page.getByRole('heading', { name: /Bronze Tier Achieved/i })).toBeVisible();
  });

  test('tier scorecard shows Bronze (achieved), Silver, Gold rows', async ({ page }) => {
    await advanceToCheckpoint(page);

    await expect(page.locator('.tier-row.achieved')).toContainText('Bronze');
    await expect(page.locator('.tier-scorecard')).toContainText('Silver');
    await expect(page.locator('.tier-scorecard')).toContainText('Gold');
  });

  test('"Continue to Gold" and "Start MCP Server" buttons are visible', async ({ page }) => {
    await advanceToCheckpoint(page);

    await expect(page.getByRole('button', { name: /Start MCP Server/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue to Gold/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('Navigation', () => {
  test('Back on Define returns to Connect', async ({ page }) => {
    await setWizardState(page, {
      step: 2,
      brief: { product_name: '', description: '', owner: { name: '', team: '', email: '' }, sensitivity: 'internal', docs: [] },
      sources: [],
      pipelineId: null,
    });
    await page.waitForSelector('#product_name', { timeout: 8_000 });

    await page.locator('.define-actions .btn-secondary').click();
    await page.waitForSelector('#connect-url', { timeout: 5_000 });
    await expect(page.locator('#stepper .step-active')).toHaveText('Connect');
  });

  test('Back on Scaffold returns to Define', async ({ page }) => {
    await setWizardState(page, {
      step: 3,
      brief: FILLED_BRIEF,
      sources: [CONNECTED_SOURCE],
      pipelineId: null,
    });
    await page.waitForSelector('#scaffold-stages', { timeout: 8_000 });

    await page.locator('#scaffold-actions .btn-secondary').click();
    await page.waitForSelector('#product_name', { timeout: 5_000 });
    await expect(page.locator('#stepper .step-active')).toHaveText('Define');
  });

  test('completed step labels in stepper are clickable and navigate back', async ({ page }) => {
    await setWizardState(page, {
      step: 3,
      brief: FILLED_BRIEF,
      sources: [CONNECTED_SOURCE],
      pipelineId: null,
    });
    await page.waitForSelector('#scaffold-stages', { timeout: 8_000 });

    const connectLabel = page.locator('#stepper .step-completed').filter({ hasText: 'Connect' });
    await connectLabel.click();

    await page.waitForSelector('#connect-url', { timeout: 5_000 });
    await expect(page.locator('#stepper .step-active')).toHaveText('Connect');
  });
});

// ---------------------------------------------------------------------------
// API contract tests
// ---------------------------------------------------------------------------

test.describe('API endpoints', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/health`);
    expect(resp.ok()).toBeTruthy();
    expect(await resp.json()).toEqual({ ok: true });
  });

  test('GET /api/auth/providers returns non-empty array', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/auth/providers`);
    expect(resp.ok()).toBeTruthy();
    const providers = await resp.json() as Array<{ id: string; displayName: string }>;
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0]).toHaveProperty('id');
    expect(providers[0]).toHaveProperty('displayName');
  });

  test('GET /api/sources returns an array', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/sources`);
    expect(resp.ok()).toBeTruthy();
    expect(Array.isArray(await resp.json())).toBe(true);
  });

  test('POST /api/pipeline/start returns a pipeline id', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/pipeline/start`, {
      data: { productName: 'e2e-api-test', targetTier: 'bronze' },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json() as { id: string; status: string };
    expect(body).toHaveProperty('id');
    expect(body.status).toBe('running');
  });

  test('GET /api/pipeline/status/:id returns pipeline with stages', async ({ request }) => {
    const startResp = await request.post(`${BASE_URL}/api/pipeline/start`, {
      data: { productName: 'e2e-status-test', targetTier: 'bronze' },
    });
    const { id } = await startResp.json() as { id: string };

    const resp = await request.get(`${BASE_URL}/api/pipeline/status/${id}`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json() as { id: string; stages: unknown[] };
    expect(body.id).toBe(id);
    expect(Array.isArray(body.stages)).toBe(true);
  });

  test('GET /api/pipeline/status for unknown id returns 404', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/pipeline/status/nonexistent-id`);
    expect(resp.status()).toBe(404);
  });

  test('POST /api/brief saves brief and GET retrieves it', async ({ request }) => {
    const brief = {
      product_name: 'e2e-brief-test',
      description: 'Created by E2E test',
      owner: { name: 'Bot', team: 'CI', email: 'bot@ci.example.com' },
      sensitivity: 'internal',
    };

    const postResp = await request.post(`${BASE_URL}/api/brief`, { data: brief });
    expect(postResp.ok()).toBeTruthy();

    const getResp = await request.get(`${BASE_URL}/api/brief/e2e-brief-test`);
    expect(getResp.ok()).toBeTruthy();
    const saved = await getResp.json() as { product_name: string; description: string };
    expect(saved.product_name).toBe('e2e-brief-test');
    expect(saved.description).toBe('Created by E2E test');
  });
});
