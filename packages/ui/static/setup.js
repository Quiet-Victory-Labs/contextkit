(function () {
  'use strict';

  var STORAGE_KEY = 'runcontext_wizard_state';
  var STEP_LABELS = ['Connect', 'Define', 'Scaffold', 'Checkpoint', 'Enrich', 'Serve'];

  // ---- State persistence ----

  function loadSavedState() {
    try {
      var saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveState() {
    try {
      var toSave = {
        step: state.step,
        brief: state.brief,
        sources: state.sources,
        pipelineId: state.pipelineId,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) { /* ignore */ }
  }

  var saved = loadSavedState();
  var state = {
    step: saved ? saved.step : 1,
    brief: saved ? saved.brief : {
      product_name: '',
      description: '',
      owner: { name: '', team: '', email: '' },
      sensitivity: 'internal',
      docs: [],
    },
    sources: saved ? saved.sources : [],
    pipelineId: saved ? saved.pipelineId : null,
    pollTimer: null,
    mcpPollTimer: null,
  };

  // ---- Helpers ----

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function showError(fieldId, msg) {
    var field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.add('error');
    var existing = field.parentElement.querySelector('.field-error');
    if (existing) existing.remove();
    if (msg) {
      var el = document.createElement('p');
      el.className = 'field-error';
      el.textContent = msg;
      field.parentElement.appendChild(el);
    }
  }

  function clearErrors() {
    $$('.error').forEach(function (el) { el.classList.remove('error'); });
    $$('.field-error').forEach(function (el) { el.remove(); });
  }

  async function api(method, path, body) {
    var opts = { method: method, headers: {} };
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body) {
      opts.body = body;
    }
    var res = await fetch(path, opts);
    if (!res.ok) {
      var text = await res.text();
      throw new Error(text || res.statusText);
    }
    var ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res.text();
  }

  // ---- DOM builder helper (avoid innerHTML for security) ----

  function createElement(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'className') el.className = attrs[key];
        else if (key === 'textContent') el.textContent = attrs[key];
        else if (key === 'htmlFor') el.htmlFor = attrs[key];
        else if (key === 'type') el.type = attrs[key];
        else el.setAttribute(key, attrs[key]);
      });
    }
    if (children) {
      children.forEach(function (child) {
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else if (child) {
          el.appendChild(child);
        }
      });
    }
    return el;
  }

  // ---- Breadcrumb Stepper ----

  function renderStepper() {
    var container = document.getElementById('stepper');
    if (!container) return;
    container.textContent = '';

    STEP_LABELS.forEach(function (label, i) {
      var stepNum = i + 1;
      var span = document.createElement('span');
      span.textContent = label;

      if (stepNum < state.step) {
        span.className = 'step-completed';
        span.addEventListener('click', function () {
          goToStep(stepNum);
        });
      } else if (stepNum === state.step) {
        span.className = 'step-active';
      } else {
        span.className = 'step-future';
      }

      container.appendChild(span);

      if (stepNum < STEP_LABELS.length) {
        var sep = document.createElement('span');
        sep.className = 'step-separator';
        sep.textContent = '>';
        container.appendChild(sep);
      }
    });
  }

  // ---- Navigation ----

  function goToStep(n) {
    if (n < 1 || n > 6) return;

    // Clear any running pipeline poll timer when navigating away
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }

    var content = document.getElementById('wizard-content');
    if (content) content.textContent = '';

    state.step = n;
    saveState();

    renderStepper();

    switch (n) {
      case 1: renderConnectStep(); break;
      case 2: renderDefineStep(); break;
      case 3: renderScaffoldStep(); break;
      case 4: renderCheckpointStep(); break;
      case 5: renderEnrichStep(); break;
      case 6: renderServeStep(); break;
    }
  }

  function validateStep(n) {
    clearErrors();
    // Step-specific validation will be added as each step is implemented
    return true;
  }

  // ---- Step action buttons helper ----

  function createStepActions(showBack, showNext, nextLabel) {
    var actions = createElement('div', { className: 'step-actions' });
    if (showBack) {
      var backBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Back' });
      backBtn.addEventListener('click', function () {
        goToStep(state.step - 1);
      });
      actions.appendChild(backBtn);
    } else {
      actions.appendChild(createElement('span'));
    }
    if (showNext) {
      var nextBtn = createElement('button', { className: 'btn btn-primary', textContent: nextLabel || 'Next' });
      nextBtn.addEventListener('click', function () {
        if (validateStep(state.step)) goToStep(state.step + 1);
      });
      actions.appendChild(nextBtn);
    }
    return actions;
  }

  // ---- Step 1: Connect ----

  function renderConnectStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card' });

    card.appendChild(createElement('h2', { className: 'connect-heading', textContent: 'Connect Your Database' }));
    card.appendChild(createElement('p', { className: 'connect-subheading', textContent: 'RunContext discovers databases from your IDE configs and environment. You can also connect via OAuth \u2014 your credentials never pass through the AI agent.' }));

    // Container for detected source cards
    var sourcesGrid = createElement('div', { className: 'source-cards', id: 'connect-sources' });
    sourcesGrid.appendChild(createElement('p', { className: 'muted', textContent: 'Detecting databases\u2026' }));
    card.appendChild(sourcesGrid);

    // Divider
    card.appendChild(createElement('div', { className: 'section-divider' }, ['Or connect a new database']));

    // Platform picker grid (populated after fetching providers)
    var platformGrid = createElement('div', { className: 'platform-grid', id: 'connect-platforms' });
    platformGrid.appendChild(createElement('p', { className: 'muted', textContent: 'Loading providers\u2026' }));
    card.appendChild(platformGrid);

    // OAuth result area (hidden until needed)
    var oauthResult = createElement('div', { id: 'connect-oauth-result' });
    card.appendChild(oauthResult);

    // Manual connection string
    var manual = createElement('div', { className: 'manual-connect' });
    manual.appendChild(createElement('label', { className: 'label-uppercase', textContent: 'Manual Connection' }));
    var manualRow = createElement('div', { className: 'manual-connect-row' });
    var connInput = createElement('input', {
      className: 'input',
      id: 'connect-url',
      type: 'text',
      placeholder: 'postgres://user:pass@host:5432/dbname',
    });
    manualRow.appendChild(connInput);
    var connBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Connect' });
    manualRow.appendChild(connBtn);
    manual.appendChild(manualRow);
    card.appendChild(manual);

    content.appendChild(card);

    // --- Fetch detected sources ---
    fetchDetectedSources(sourcesGrid);

    // --- Fetch auth providers ---
    fetchAuthProviders(platformGrid, oauthResult);

    // --- Manual connect handler ---
    connBtn.addEventListener('click', async function () {
      var url = connInput.value.trim();
      if (!url) return;
      connBtn.textContent = 'Connecting\u2026';
      connBtn.disabled = true;
      try {
        var result = await api('POST', '/api/sources', { connection_url: url });
        var src = result.source || result;
        state.sources = state.sources || [];
        state.sources.push(src);
        saveState();
        updateDbStatus(src);
        goToStep(2);
      } catch (e) {
        connBtn.textContent = 'Connect';
        connBtn.disabled = false;
        var errP = manual.querySelector('.field-error');
        if (errP) errP.remove();
        manual.appendChild(createElement('p', { className: 'field-error', textContent: e.message || 'Connection failed' }));
      }
    });
  }

  function fetchDetectedSources(container) {
    api('GET', '/api/sources').then(function (data) {
      var sources = data.sources || data || [];
      container.textContent = '';
      if (sources.length === 0) {
        container.appendChild(createElement('p', { className: 'muted', textContent: 'No databases auto-detected.' }));
        updateDbStatus(null);
        return;
      }
      sources.forEach(function (src) {
        var card = createElement('div', { className: 'source-card' }, [
          createElement('span', { className: 'source-card-name', textContent: src.name || src.adapter }),
          createElement('span', { className: 'source-card-meta', textContent: (src.adapter || '') + (src.origin ? ' \u2022 ' + src.origin : '') }),
          createElement('button', { className: 'btn btn-primary', textContent: 'Use This' }),
        ]);
        card.querySelector('.btn').addEventListener('click', async function () {
          try {
            await api('POST', '/api/sources', src);
            state.sources = state.sources || [];
            state.sources.push(src);
            saveState();
            updateDbStatus(src);
            goToStep(2);
          } catch (e) {
            container.appendChild(createElement('p', { className: 'field-error', textContent: e.message || 'Failed to select source' }));
          }
        });
        container.appendChild(card);
      });
    }).catch(function () {
      container.textContent = '';
      container.appendChild(createElement('p', { className: 'muted', textContent: 'Could not detect databases.' }));
      updateDbStatus(null);
    });
  }

  function fetchAuthProviders(container, oauthResult) {
    api('GET', '/api/auth/providers').then(function (data) {
      var providers = data.providers || data || [];
      container.textContent = '';
      if (providers.length === 0) {
        container.appendChild(createElement('p', { className: 'muted', textContent: 'No OAuth providers available.' }));
        return;
      }
      providers.forEach(function (prov) {
        var btn = createElement('button', { className: 'platform-btn', textContent: prov.display_name || prov.name || prov.id });
        btn.addEventListener('click', function () {
          startOAuthFlow(prov, container, oauthResult);
        });
        container.appendChild(btn);
      });
    }).catch(function () {
      container.textContent = '';
      container.appendChild(createElement('p', { className: 'muted', textContent: 'Could not load providers.' }));
    });
  }

  async function startOAuthFlow(provider, platformGrid, oauthResult) {
    // Show loading state on the platform grid
    platformGrid.querySelectorAll('.platform-btn').forEach(function (b) { b.disabled = true; });
    oauthResult.textContent = '';
    oauthResult.appendChild(createElement('p', { className: 'muted', textContent: 'Connecting to ' + (provider.display_name || provider.id) + '\u2026' }));

    try {
      var data = await api('POST', '/api/auth/start', { provider: provider.id });
      var databases = data.databases || data || [];
      oauthResult.textContent = '';

      if (databases.length === 0) {
        oauthResult.appendChild(createElement('p', { className: 'muted', textContent: 'No databases found for this provider.' }));
        platformGrid.querySelectorAll('.platform-btn').forEach(function (b) { b.disabled = false; });
        return;
      }

      oauthResult.appendChild(createElement('label', { className: 'label-uppercase', textContent: 'Select a database' }));
      var dbGrid = createElement('div', { className: 'source-cards' });
      databases.forEach(function (db) {
        var dbCard = createElement('div', { className: 'source-card' }, [
          createElement('span', { className: 'source-card-name', textContent: db.name || db.database }),
          createElement('span', { className: 'source-card-meta', textContent: db.adapter || db.type || '' }),
          createElement('button', { className: 'btn btn-primary', textContent: 'Use This' }),
        ]);
        dbCard.querySelector('.btn').addEventListener('click', async function () {
          try {
            await api('POST', '/api/auth/select-db', { provider: provider.id, database: db });
            state.sources = state.sources || [];
            state.sources.push(db);
            saveState();
            updateDbStatus(db);
            goToStep(2);
          } catch (e) {
            oauthResult.appendChild(createElement('p', { className: 'field-error', textContent: e.message || 'Failed to select database' }));
          }
        });
        dbGrid.appendChild(dbCard);
      });
      oauthResult.appendChild(dbGrid);
    } catch (e) {
      oauthResult.textContent = '';
      oauthResult.appendChild(createElement('p', { className: 'field-error', textContent: e.message || 'OAuth flow failed' }));
      platformGrid.querySelectorAll('.platform-btn').forEach(function (b) { b.disabled = false; });
    }
  }

  // ---- Step 2: Define (placeholder) ----

  function renderDefineStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;
    var card = createElement('div', { className: 'card' });
    card.appendChild(createElement('h2', { textContent: 'Define' }));
    card.appendChild(createElement('p', { className: 'muted', textContent: 'Coming soon.' }));
    card.appendChild(createStepActions(true, true));
    content.appendChild(card);
  }

  // ---- Step 3: Scaffold (placeholder) ----

  function renderScaffoldStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;
    var card = createElement('div', { className: 'card' });
    card.appendChild(createElement('h2', { textContent: 'Scaffold' }));
    card.appendChild(createElement('p', { className: 'muted', textContent: 'Coming soon.' }));
    card.appendChild(createStepActions(true, true));
    content.appendChild(card);
  }

  // ---- Step 4: Checkpoint (placeholder) ----

  function renderCheckpointStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;
    var card = createElement('div', { className: 'card' });
    card.appendChild(createElement('h2', { textContent: 'Checkpoint' }));
    card.appendChild(createElement('p', { className: 'muted', textContent: 'Coming soon.' }));
    card.appendChild(createStepActions(true, true));
    content.appendChild(card);
  }

  // ---- Step 5: Enrich (placeholder) ----

  function renderEnrichStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;
    var card = createElement('div', { className: 'card' });
    card.appendChild(createElement('h2', { textContent: 'Enrich' }));
    card.appendChild(createElement('p', { className: 'muted', textContent: 'Coming soon.' }));
    card.appendChild(createStepActions(true, true));
    content.appendChild(card);
  }

  // ---- Step 6: Serve (placeholder) ----

  function renderServeStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;
    var card = createElement('div', { className: 'card' });
    card.appendChild(createElement('h2', { textContent: 'Serve' }));
    card.appendChild(createElement('p', { className: 'muted', textContent: 'Coming soon.' }));
    card.appendChild(createStepActions(true, false));
    content.appendChild(card);
  }

  // ---- Review / Build helpers (will be re-implemented in later tasks) ----

  function createReviewRow(label, value) {
    return createElement('div', { className: 'review-row' }, [
      createElement('span', { className: 'review-label', textContent: label }),
      createElement('span', { className: 'review-value', textContent: value }),
    ]);
  }

  // ---- Existing Products Banner ----

  async function checkExistingProducts() {
    try {
      var res = await fetch('/api/products');
      var products = await res.json();
      if (products.length > 0) {
        var content = document.getElementById('wizard-content');
        if (!content) return;

        var banner = createElement('div', { className: 'existing-products-banner' });

        var title = createElement('p', { className: 'banner-title' });
        title.textContent = 'Your semantic plane has ' + products.length + ' data product' + (products.length === 1 ? '' : 's') + '. Adding another.';
        banner.appendChild(title);

        var list = createElement('div', { className: 'product-chips' });
        for (var i = 0; i < products.length; i++) {
          list.appendChild(createElement('span', { className: 'product-chip', textContent: products[i].name }));
        }
        banner.appendChild(list);

        // Insert banner before the first card
        var firstCard = content.querySelector('.card');
        if (firstCard) {
          content.insertBefore(banner, firstCard);
        } else {
          content.appendChild(banner);
        }
      }
    } catch (e) {
      // ignore - not critical
    }
  }

  // ---- Sidebar Interactions ----

  function setupSidebarLocked() {
    var tooltip = document.getElementById('locked-tooltip');
    if (!tooltip) return;

    $$('.nav-item.locked').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var rect = item.getBoundingClientRect();
        tooltip.style.display = 'block';
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 6) + 'px';
      });
    });

    document.addEventListener('click', function (e) {
      if (tooltip.style.display !== 'none') {
        var isLocked = false;
        $$('.nav-item.locked').forEach(function (item) {
          if (item.contains(e.target)) isLocked = true;
        });
        if (!isLocked) {
          tooltip.style.display = 'none';
        }
      }
    });
  }

  // ---- Sidebar Status Polling ----

  function pollMcpStatus() {
    async function check() {
      var dot = document.getElementById('mcp-status-dot');
      var text = document.getElementById('mcp-status-text');
      if (!dot || !text) return;
      try {
        var res = await fetch('http://localhost:3333/health', { method: 'GET' });
        if (res.ok) {
          dot.classList.remove('error');
          dot.classList.add('success');
          text.textContent = 'connected';
          // Also update the MCP server status in sidebar-status
          var serverDot = document.getElementById('mcp-server-dot');
          var serverText = document.getElementById('mcp-server-text');
          if (serverDot) { serverDot.classList.remove('error'); serverDot.classList.add('success'); }
          if (serverText) serverText.textContent = 'MCP running';
        } else {
          dot.classList.remove('success');
          dot.classList.add('error');
          text.textContent = 'error';
        }
      } catch (e) {
        dot.classList.remove('success');
        dot.classList.add('error');
        text.textContent = 'offline';
        var serverDot = document.getElementById('mcp-server-dot');
        var serverText = document.getElementById('mcp-server-text');
        if (serverDot) { serverDot.classList.remove('success'); serverDot.classList.add('error'); }
        if (serverText) serverText.textContent = 'MCP stopped';
      }
    }
    check();
    state.mcpPollTimer = setInterval(check, 5000);
  }

  function updateDbStatus(source) {
    var dot = document.getElementById('db-status-dot');
    var text = document.getElementById('db-status-text');
    if (!dot || !text) return;
    if (source) {
      dot.classList.remove('error');
      dot.classList.add('success');
      text.textContent = (source.name || source.adapter) + ' connected';
    } else {
      dot.classList.remove('success');
      dot.classList.add('error');
      text.textContent = 'No database';
    }
  }

  // ---- Init ----

  function init() {
    setupSidebarLocked();
    pollMcpStatus();
    goToStep(state.step);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
