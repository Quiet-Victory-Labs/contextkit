import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { briefRoutes } from './routes/api/brief.js';
import { sourcesRoutes } from './routes/api/sources.js';
import { uploadRoutes } from './routes/api/upload.js';
import { pipelineRoutes } from './routes/api/pipeline.js';
import { productsRoutes } from './routes/api/products.js';
import { authRoutes } from './routes/api/auth.js';

export interface UIServerOptions {
  rootDir: string;
  contextDir: string;
  port: number;
  host: string;
}

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, '..', 'static');

export function createApp(opts: UIServerOptions): Hono {
  const app = new Hono();

  app.use('*', cors({
    origin: (origin) => {
      // Allow requests with no origin (e.g. same-origin, curl, server-to-server)
      if (!origin) return origin;
      // Allow localhost on any port
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return origin;
      }
      return null;
    },
  }));

  app.route('', briefRoutes(opts.contextDir));
  app.route('', sourcesRoutes(opts.rootDir, opts.contextDir));
  app.route('', uploadRoutes(opts.contextDir));
  app.route('', pipelineRoutes(opts.rootDir, opts.contextDir));
  app.route('', productsRoutes(opts.contextDir));
  app.route('', authRoutes(opts.rootDir));

  app.get('/api/health', (c) => c.json({ ok: true }));

  // Static file serving (CSS, JS)
  app.get('/static/:filename', (c) => {
    const filename = c.req.param('filename');
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return c.text('Not found', 404);
    }
    const filePath = path.join(staticDir, filename);
    if (!fs.existsSync(filePath)) return c.text('Not found', 404);

    const ext = path.extname(filename);
    const contentType =
      ext === '.css' ? 'text/css'
      : ext === '.js' ? 'application/javascript'
      : 'application/octet-stream';

    return c.body(fs.readFileSync(filePath), 200, { 'Content-Type': contentType });
  });

  app.get('/setup', (c) => {
    return c.html(setupPageHTML());
  });

  app.get('/', (c) => c.redirect('/setup'));

  return app;
}

function setupPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RunContext — Build Your Data Product</title>
  <link rel="stylesheet" href="/static/uxd.css" />
  <link rel="stylesheet" href="/static/setup.css" />
</head>
<body>
  <div class="wizard">
    <header class="wizard-header">
      <h1>RunContext</h1>
      <p class="tagline">Build your data product. AI handles the rest.</p>
    </header>

    <div class="progress-bar">
      <div class="progress-step active" data-step="1"><span class="step-num">1</span><span class="step-label">Product</span></div>
      <div class="progress-step" data-step="2"><span class="step-num">2</span><span class="step-label">Owner</span></div>
      <div class="progress-step" data-step="3"><span class="step-num">3</span><span class="step-label">Context</span></div>
      <div class="progress-step" data-step="4"><span class="step-num">4</span><span class="step-label">Review</span></div>
      <div class="progress-step" data-step="5"><span class="step-num">5</span><span class="step-label">Build</span></div>
    </div>

    <!-- Step 1: Product Name + Description -->
    <div class="step active" id="step-1">
      <h2>Name your data product</h2>
      <div class="field">
        <label for="product-name">Product Name</label>
        <input type="text" id="product-name" class="input" placeholder="e.g. player-engagement" />
        <p class="hint">Letters, numbers, dashes, underscores only</p>
      </div>
      <div class="field">
        <label for="description">Description</label>
        <div class="textarea-wrapper">
          <textarea id="description" class="textarea" rows="4" placeholder="Describe what this data product covers..."></textarea>
          <button type="button" id="voice-btn" class="btn-icon" title="Voice input">\u{1F3A4}</button>
        </div>
      </div>
      <div class="step-actions">
        <div></div>
        <button type="button" class="btn btn-primary" data-next>Next</button>
      </div>
    </div>

    <!-- Step 2: Owner -->
    <div class="step" id="step-2">
      <h2>Who owns this data?</h2>
      <div class="field">
        <label for="owner-name">Your Name</label>
        <input type="text" id="owner-name" class="input" placeholder="e.g. Tyler" />
      </div>
      <div class="field">
        <label for="owner-team">Team</label>
        <input type="text" id="owner-team" class="input" placeholder="e.g. Analytics" />
      </div>
      <div class="field">
        <label for="owner-email">Email</label>
        <input type="email" id="owner-email" class="input" placeholder="e.g. tyler@company.com" />
      </div>
      <div class="step-actions">
        <button type="button" class="btn btn-secondary" data-prev>Back</button>
        <button type="button" class="btn btn-primary" data-next>Next</button>
      </div>
    </div>

    <!-- Step 3: Sensitivity + Sources + Upload -->
    <div class="step" id="step-3">
      <h2>Context &amp; sensitivity</h2>
      <div class="field">
        <label>Data Sensitivity</label>
        <div class="sensitivity-cards">
          <div class="card" data-sensitivity="public">
            <strong>Public</strong>
            <p>Open data, no restrictions</p>
          </div>
          <div class="card selected" data-sensitivity="internal">
            <strong>Internal</strong>
            <p>Company use only</p>
          </div>
          <div class="card" data-sensitivity="confidential">
            <strong>Confidential</strong>
            <p>Need-to-know basis</p>
          </div>
          <div class="card" data-sensitivity="restricted">
            <strong>Restricted</strong>
            <p>Strict access controls</p>
          </div>
        </div>
      </div>

      <div class="field">
        <label>Data Sources</label>
        <div id="sources-list" class="source-cards">
          <p class="muted">Detecting data sources...</p>
        </div>
      </div>

      <div class="field">
        <label>Documentation (optional)</label>
        <div id="upload-area" class="upload-area">
          <p>Drop files here or click to upload</p>
          <p class="hint">Supports .md, .txt, .pdf, .csv, .json, .yaml, .sql</p>
          <input type="file" id="file-input" hidden multiple accept=".md,.txt,.pdf,.csv,.json,.yaml,.yml,.sql,.html" />
        </div>
        <div id="uploaded-files"></div>
      </div>

      <div class="step-actions">
        <button type="button" class="btn btn-secondary" data-prev>Back</button>
        <button type="button" class="btn btn-primary" data-next>Next</button>
      </div>
    </div>

    <!-- Step 4: Review -->
    <div class="step" id="step-4">
      <h2>Review your data product</h2>
      <div id="review-content" class="review-content"></div>
      <div class="step-actions">
        <button type="button" class="btn btn-secondary" data-prev>Back</button>
        <button type="button" class="btn btn-primary" data-next>Build it</button>
      </div>
    </div>

    <!-- Step 5: Build Pipeline -->
    <div class="step" id="step-5">
      <h2>Building your semantic plane</h2>
      <div id="pipeline-timeline" class="pipeline-timeline"></div>
      <div id="pipeline-done" class="pipeline-done" style="display:none">
        <p>Your semantic plane is live. AI agents can now query your data with context.</p>
        <p class="muted">Powered by RunContext \u00B7 Open Semantic Interchange</p>
      </div>
    </div>

    <footer class="wizard-footer">
      <p>Powered by RunContext \u00B7 Open Semantic Interchange</p>
    </footer>
  </div>
  <script src="/static/setup.js"></script>
</body>
</html>`;
}

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

    server.on('error', reject);
  });
}
