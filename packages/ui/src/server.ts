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
import { suggestBriefRoutes } from './routes/api/suggest-brief.js';
import { attachWebSocket } from './routes/ws.js';
import { setupBus } from './events.js';

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
  app.route('', suggestBriefRoutes(opts.rootDir));

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.post('/api/session', (c) => {
    const id = setupBus.createSession();
    return c.json({ sessionId: id });
  });

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

  app.get('/planes', (c) => {
    return c.html(pageHTML({
      title: 'Semantic Planes',
      activePage: 'planes',
      contentId: 'page-content',

    }));
  });

  app.get('/analytics', (c) => {
    return c.html(pageHTML({
      title: 'Analytics',
      activePage: 'analytics',
      contentId: 'page-content',

    }));
  });

  app.get('/settings', (c) => {
    return c.html(pageHTML({
      title: 'Settings',
      activePage: 'settings',
      contentId: 'page-content',

    }));
  });

  app.get('/', (c) => c.redirect('/setup'));

  return app;
}

interface PageHTMLOptions {
  title: string;
  activePage: 'setup' | 'planes' | 'analytics' | 'settings';
  contentId: string;
}

function sidebarHTML(activePage: PageHTMLOptions['activePage']): string {
  const nav = (page: PageHTMLOptions['activePage'], href: string, label: string) => {
    const isActive = activePage === page;
    return `<a class="nav-item${isActive ? ' active' : ''}" href="${href}">
          <span>${label}</span>
        </a>`;
  };

  return `<aside class="sidebar">
      <div class="sidebar-brand">
        <svg class="brand-chevron" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 4l8 8-8 8" stroke="#c9a55a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 4l8 8-8 8" stroke="#c9a55a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
        </svg>
        <span class="brand-text">
          <span class="brand-run">Run</span><span class="brand-context">Context</span>
        </span>
        <span class="brand-badge">Local</span>
      </div>
      <nav class="sidebar-nav">
        ${nav('setup', '/setup', 'Setup')}
        ${nav('planes', '/planes', 'Semantic Planes')}
        ${nav('analytics', '/analytics', 'Analytics')}
        <div class="nav-item mcp-toggle" id="mcp-nav-toggle" title="Click to start/stop MCP server" style="cursor:pointer">
          <span class="status-dot" id="mcp-status-dot"></span>
          <span>MCP Server</span>
          <span class="nav-detail" id="mcp-status-text">checking...</span>
        </div>
        ${nav('settings', '/settings', 'Settings')}
      </nav>
      <div class="sidebar-status">
        <div class="status-row">
          <span class="status-dot" id="db-status-dot"></span>
          <span id="db-status-text">No database</span>
        </div>
        <div class="status-row mcp-toggle" id="mcp-toggle-row" title="Click to start/stop MCP server">
          <span class="status-dot" id="mcp-server-dot"></span>
          <span id="mcp-server-text">MCP stopped</span>
        </div>
        <div class="status-row" id="tier-row">
          <span class="tier-badge" id="tier-badge">Free</span>
        </div>
      </div>
      <div class="sidebar-security">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rc-color-status-success)" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Local-only processing</span>
      </div>
    </aside>`;
}

function footerHTML(): string {
  return `<footer class="app-footer">
      <span>Powered by <a href="https://runcontext.dev" target="_blank" rel="noopener">RunContext</a></span>
      <span class="footer-links">
        <a href="https://docs.runcontext.dev" target="_blank" rel="noopener">Docs</a>
        <span class="footer-sep">&middot;</span>
        <a href="https://runcontext.dev/pricing" target="_blank" rel="noopener">Cloud</a>
        <span class="footer-sep">&middot;</span>
        <a href="https://github.com/Quiet-Victory-Labs/runcontext" target="_blank" rel="noopener">GitHub</a>
      </span>
    </footer>`;
}

function pageHTML(opts: PageHTMLOptions): string {
  const isSetup = opts.activePage === 'setup';
  const headerContent = isSetup
    ? `<div class="header-stepper" id="stepper"></div>`
    : `<h1 class="header-title">${opts.title}</h1>`;
  const lockedTooltip = isSetup
    ? `\n  <!-- Locked tooltip (hidden by default) -->
  <div class="locked-tooltip" id="locked-tooltip" style="display:none">
    <p><strong>Cloud Feature</strong></p>
    <p>This feature is available on RunContext Cloud with team collaboration, hosted endpoints, and analytics.</p>
    <a href="https://runcontext.dev/pricing" target="_blank" rel="noopener">View plans →</a>
  </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RunContext — ${opts.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/static/uxd.css" />
  <link rel="stylesheet" href="/static/setup.css" />
</head>
<body data-page="${opts.activePage}">
  <div class="app-shell">
    <!-- Sidebar -->
    ${sidebarHTML(opts.activePage)}

    <!-- Header -->
    <header class="app-header">
      ${headerContent}
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <div class="content-wrapper" id="${opts.contentId}"></div>
    </main>

    <!-- Footer -->
    ${footerHTML()}
  </div>
${lockedTooltip}
  <script src="/static/app.js"></script>
</body>
</html>`;
}

function setupPageHTML(): string {
  return pageHTML({
    title: 'Build Your Context Layer',
    activePage: 'setup',
    contentId: 'wizard-content',
  });
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

    attachWebSocket(server as unknown as import('node:http').Server);

    server.on('error', reject);
  });
}
