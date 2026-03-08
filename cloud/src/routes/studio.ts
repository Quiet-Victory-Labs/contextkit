import { Hono } from 'hono';

const studio = new Hono();

// ---------------------------------------------------------------------------
// Shared HTML helpers
// ---------------------------------------------------------------------------

function pageShell(title: string, body: string, opts?: { scripts?: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${studioCSS()}</style>
</head>
<body>
${body}
${opts?.scripts ?? ''}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// GET /studio — org selector landing page
// ---------------------------------------------------------------------------

studio.get('/studio', (c) => {
  const html = pageShell('ContextKit Studio', `
  <div class="studio-container">
    <header class="studio-header">
      <h1>ContextKit <span class="accent">Studio</span></h1>
      <p class="tagline">Explore published semantic planes</p>
    </header>

    <div class="card org-selector">
      <h2>Select an organization</h2>
      <p class="text-muted">Enter the org slug to view its published semantic plane.</p>
      <form id="org-form" class="org-form">
        <div class="field">
          <label for="org-input">Organization</label>
          <input type="text" id="org-input" class="input" placeholder="e.g. acme-corp" required pattern="[a-zA-Z0-9_-]+" />
          <p class="hint">Letters, numbers, dashes, underscores only</p>
        </div>
        <button type="submit" class="btn btn-primary">View Studio</button>
      </form>
    </div>

    <footer class="studio-footer">
      <p>Powered by ContextKit &middot; Open Semantic Interchange</p>
    </footer>
  </div>`, {
    scripts: `<script>${orgSelectorJS()}</script>`,
  });
  return c.html(html);
});

// ---------------------------------------------------------------------------
// GET /studio/:org — org dashboard
// ---------------------------------------------------------------------------

const ORG_SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

studio.get('/studio/:org', (c) => {
  const org = c.req.param('org');
  if (!ORG_SLUG_RE.test(org)) {
    return c.redirect('/studio');
  }
  const html = pageShell(`${escapeHtml(org)} — ContextKit Studio`, `
  <div class="studio-container studio-dashboard">
    <header class="studio-header">
      <a href="/studio" class="back-link">&larr; Back</a>
      <h1>ContextKit <span class="accent">Studio</span></h1>
      <p class="tagline">Org: <strong id="org-name">${escapeHtml(org)}</strong></p>
    </header>

    <div id="loading" class="card loading-card">
      <p>Loading semantic plane...</p>
    </div>

    <div id="error" class="card error-card" style="display:none">
      <p id="error-msg"></p>
      <a href="/studio" class="btn btn-secondary">Try another org</a>
    </div>

    <div id="dashboard" style="display:none">
      <div class="card">
        <h2>Search</h2>
        <div class="search-row">
          <input type="text" id="search-input" class="input" placeholder="Search models, terms, rules..." />
          <button type="button" id="search-btn" class="btn btn-primary">Search</button>
        </div>
        <div id="search-results"></div>
      </div>

      <div class="card">
        <h2>Manifest</h2>
        <div class="meta-row">
          <span class="meta-label">Version:</span>
          <span id="manifest-version" class="meta-value">&mdash;</span>
          <span class="meta-label">Published:</span>
          <span id="manifest-published" class="meta-value">&mdash;</span>
        </div>
      </div>

      <div class="card">
        <h2>Products</h2>
        <div id="products-list" class="grid"></div>
      </div>

      <div class="card">
        <h2>Models</h2>
        <div id="models-list" class="grid"></div>
      </div>
    </div>

    <footer class="studio-footer">
      <p>Powered by ContextKit &middot; Open Semantic Interchange</p>
    </footer>
  </div>`, {
    scripts: `<script>var STUDIO_ORG=${safeJsonForScript(org)};${dashboardJS()}</script>`,
  });
  return c.html(html);
});

// ---------------------------------------------------------------------------
// CSS (inlined)
// ---------------------------------------------------------------------------

function studioCSS(): string {
  return `
:root {
  --bg: #0a0a0f;
  --surface: #111118;
  --surface-hover: #16161f;
  --border: #222233;
  --border-focus: #4f9eff;
  --text: #e4e4e7;
  --text-muted: #71717a;
  --accent: #4f9eff;
  --accent-hover: #3b8beb;
  --success: #22c55e;
  --error: #ef4444;
  --font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --radius: 8px;
  --radius-sm: 4px;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
}

.studio-container { width: 100%; max-width: 800px; }

.studio-header { text-align: center; margin-bottom: 2rem; }
.studio-header h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; }
.accent { color: var(--accent); }
.tagline { color: var(--text-muted); margin-top: 0.25rem; }
.text-muted { color: var(--text-muted); }

.back-link {
  display: inline-block;
  color: var(--accent);
  text-decoration: none;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.back-link:hover { text-decoration: underline; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow);
}
.card h2 { font-size: 1.1rem; margin-bottom: 1rem; }

.field { margin-bottom: 1rem; }
.field label { display: block; font-weight: 500; margin-bottom: 0.25rem; font-size: 0.9rem; }
.hint { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }

.input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.15s;
}
.input:focus { border-color: var(--border-focus); }

.btn {
  padding: 0.6rem 1.25rem;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-secondary { background: var(--surface-hover); color: var(--text); border: 1px solid var(--border); }

.org-form { display: flex; flex-direction: column; gap: 1rem; }
.org-form .btn { align-self: flex-start; }

.search-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.search-row .input { flex: 1; }

.meta-row {
  display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;
  font-size: 0.9rem;
}
.meta-label { color: var(--text-muted); }
.meta-value { font-weight: 500; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.grid-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 1rem;
  transition: border-color 0.15s;
}
.grid-card:hover { border-color: var(--accent); }
.grid-card h3 { font-size: 0.95rem; margin-bottom: 0.25rem; }
.grid-card p { font-size: 0.8rem; color: var(--text-muted); }

.result-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}
.result-item:last-child { border-bottom: none; }
.result-type { color: var(--accent); font-size: 0.8rem; text-transform: uppercase; margin-right: 0.5rem; }

.loading-card p, .error-card p { text-align: center; }
.error-card { border-color: var(--error); }
.error-card p { color: var(--error); margin-bottom: 1rem; }
.error-card .btn { display: inline-block; text-decoration: none; }

.empty { color: var(--text-muted); font-size: 0.9rem; font-style: italic; }

.studio-footer { text-align: center; margin-top: 2rem; font-size: 0.8rem; color: var(--text-muted); }
`;
}

// ---------------------------------------------------------------------------
// Client JS: org selector
// ---------------------------------------------------------------------------

function orgSelectorJS(): string {
  return `
(function() {
  var form = document.getElementById('org-form');
  var input = document.getElementById('org-input');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var org = input.value.trim();
    if (org) {
      window.location.href = '/studio/' + encodeURIComponent(org);
    }
  });
})();
`;
}

// ---------------------------------------------------------------------------
// Client JS: dashboard (uses only safe DOM methods — no innerHTML)
// ---------------------------------------------------------------------------

function dashboardJS(): string {
  return `
(function() {
  var org = STUDIO_ORG;
  var loadingEl = document.getElementById('loading');
  var errorEl = document.getElementById('error');
  var errorMsg = document.getElementById('error-msg');
  var dashboardEl = document.getElementById('dashboard');
  var versionEl = document.getElementById('manifest-version');
  var publishedEl = document.getElementById('manifest-published');
  var productsEl = document.getElementById('products-list');
  var modelsEl = document.getElementById('models-list');
  var searchInput = document.getElementById('search-input');
  var searchBtn = document.getElementById('search-btn');
  var searchResults = document.getElementById('search-results');

  function clearChildren(el) {
    while (el.firstChild) { el.removeChild(el.firstChild); }
  }

  function showError(msg) {
    loadingEl.style.display = 'none';
    errorMsg.textContent = msg;
    errorEl.style.display = '';
  }

  function showDashboard() {
    loadingEl.style.display = 'none';
    dashboardEl.style.display = '';
  }

  function makeCard(title, desc) {
    var div = document.createElement('div');
    div.className = 'grid-card';
    var h3 = document.createElement('h3');
    h3.textContent = title;
    div.appendChild(h3);
    if (desc) {
      var p = document.createElement('p');
      p.textContent = desc;
      div.appendChild(p);
    }
    return div;
  }

  function renderProducts(products) {
    clearChildren(productsEl);
    if (!products || products.length === 0) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'No products published yet.';
      productsEl.appendChild(p);
      return;
    }
    products.forEach(function(name) {
      productsEl.appendChild(makeCard(name, 'Data product'));
    });
  }

  function renderModels(models) {
    clearChildren(modelsEl);
    if (!models || Object.keys(models).length === 0) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'No models found.';
      modelsEl.appendChild(p);
      return;
    }
    Object.keys(models).forEach(function(name) {
      var model = models[name];
      var desc = (model && model.description) ? String(model.description) : '';
      modelsEl.appendChild(makeCard(name, desc));
    });
  }

  function renderSearchResults(results) {
    clearChildren(searchResults);
    if (!results || results.length === 0) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'No results found.';
      searchResults.appendChild(p);
      return;
    }
    results.forEach(function(r) {
      var div = document.createElement('div');
      div.className = 'result-item';
      var span = document.createElement('span');
      span.className = 'result-type';
      span.textContent = r.type;
      div.appendChild(span);
      var nameSpan = document.createElement('span');
      nameSpan.textContent = r.name;
      div.appendChild(nameSpan);
      searchResults.appendChild(div);
    });
  }

  function doSearch() {
    var q = searchInput.value.trim();
    if (!q) { clearChildren(searchResults); return; }
    fetch('/api/orgs/' + encodeURIComponent(org) + '/search?q=' + encodeURIComponent(q))
      .then(function(r) { return r.json(); })
      .then(function(data) { renderSearchResults(data.results || []); })
      .catch(function() { renderSearchResults([]); });
  }

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doSearch();
  });

  // Load manifest
  fetch('/api/orgs/' + encodeURIComponent(org) + '/manifest')
    .then(function(r) {
      if (!r.ok) throw new Error('Org not found or has no published plane.');
      return r.json();
    })
    .then(function(data) {
      versionEl.textContent = 'v' + (data.version || '?');
      publishedEl.textContent = data.publishedAt ? new Date(data.publishedAt).toLocaleString() : String.fromCharCode(8212);

      var manifest = data.manifest || {};
      renderModels(manifest.models || {});

      // Load products
      return fetch('/api/orgs/' + encodeURIComponent(org) + '/products');
    })
    .then(function(r) {
      if (!r.ok) throw new Error('Failed to load products.');
      return r.json();
    })
    .then(function(data) {
      renderProducts(data.products || []);
      showDashboard();
    })
    .catch(function(err) {
      showError(err.message || 'Failed to load data.');
    });
})();
`;
}

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

/** Safely encode a value for embedding in an inline <script> block. */
function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export { studio };
