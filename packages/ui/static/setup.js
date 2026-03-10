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

  // ---- WebSocket Client ----
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
      setTimeout(function () {
        if (wsSessionId) connectWebSocket(wsSessionId);
      }, 2000);
    };

    ws.onerror = function () { /* ignore, onclose handles reconnect */ };
  }

  function sendWsEvent(type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: type, sessionId: wsSessionId, payload: payload || {} }));
    }
  }

  function handleWsEvent(event) {
    switch (event.type) {
      case 'setup:step':
        if (event.payload && event.payload.step) {
          goToStep(event.payload.step);
        }
        break;
      case 'setup:field':
        if (event.payload && event.payload.fieldId) {
          var input = document.getElementById(event.payload.fieldId);
          if (input) {
            input.value = event.payload.value || '';
            input.dispatchEvent(new Event('input'));
          }
        }
        break;
      case 'pipeline:stage':
        updateStageFromWs(event.payload || {});
        break;
      case 'enrich:progress':
        updateEnrichProgress(event.payload || {});
        break;
      case 'enrich:log':
        appendEnrichLog(event.payload || {});
        break;
      case 'tier:update':
        if (event.payload && event.payload.tier) {
          var badge = document.getElementById('tier-badge');
          if (badge) badge.textContent = event.payload.tier;
        }
        break;
    }
  }

  function updateStageFromWs(payload) {
    // Update stage dots in the scaffold step
    var stageEl = document.querySelector('[data-stage="' + payload.stage + '"]');
    if (!stageEl) return;
    var dot = stageEl.querySelector('.stage-dot');
    if (dot) {
      dot.className = 'stage-dot';
      if (payload.status === 'running') dot.className += ' running';
      else if (payload.status === 'done') dot.className += ' done';
      else if (payload.status === 'error') dot.className += ' error';
    }
    var summary = stageEl.querySelector('.stage-summary');
    if (summary && payload.summary) {
      summary.textContent = payload.summary;
    }
  }

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
    card.appendChild(createElement('p', { className: 'connect-subheading', textContent: 'RunContext connects directly to your database via OAuth \u2014 your credentials never pass through the AI agent.' }));

    // Detected databases hint (from MCP/IDE configs)
    var detectedHint = createElement('div', { id: 'connect-detected-hint' });
    card.appendChild(detectedHint);

    // OAuth result area — positioned right after detected hint so db cards appear here
    var oauthResult = createElement('div', { id: 'connect-oauth-result' });
    card.appendChild(oauthResult);

    // Platform picker grid (populated after fetching providers)
    var platformGrid = createElement('div', { className: 'platform-grid', id: 'connect-platforms' });
    platformGrid.appendChild(createElement('p', { className: 'muted', textContent: 'Loading providers\u2026' }));
    card.appendChild(platformGrid);

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

    // --- Detect sources first, then render providers (detected ones get highlighted) ---
    fetchDetectedSources(detectedHint, platformGrid, oauthResult).then(function () {
      fetchAuthProviders(platformGrid, oauthResult);
    });

    // --- Manual connect handler ---
    connBtn.addEventListener('click', async function () {
      var url = connInput.value.trim();
      if (!url) return;
      connBtn.textContent = 'Connecting\u2026';
      connBtn.disabled = true;
      try {
        var result = await api('POST', '/api/sources', { connection: url });
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

  /** Map adapter type to the provider ID for OAuth */
  var ADAPTER_TO_PROVIDER = {
    postgres: 'neon', // default; detected sources refine below
    mysql: 'planetscale',
    duckdb: null, // local file, no OAuth needed
    sqlite: null,
    snowflake: 'snowflake',
    bigquery: 'gcp',
    clickhouse: 'clickhouse',
    databricks: 'databricks',
    mssql: 'azure-sql',
    mongodb: 'mongodb',
  };

  /** Refine provider from origin hint (e.g. "mcp:claude-code/neon" → neon) */
  function providerFromOrigin(origin, adapter) {
    if (!origin) return ADAPTER_TO_PROVIDER[adapter] || null;
    var o = origin.toLowerCase();
    if (o.includes('neon')) return 'neon';
    if (o.includes('supabase')) return 'supabase';
    if (o.includes('aws') || o.includes('rds')) return 'aws-rds';
    if (o.includes('azure')) return 'azure-sql';
    if (o.includes('gcp') || o.includes('bigquery')) return 'gcp';
    if (o.includes('planetscale')) return 'planetscale';
    if (o.includes('cockroach')) return 'cockroachdb';
    if (o.includes('snowflake')) return 'snowflake';
    if (o.includes('clickhouse')) return 'clickhouse';
    if (o.includes('databricks')) return 'databricks';
    if (o.includes('mongodb') || o.includes('atlas')) return 'mongodb';
    if (o.includes('motherduck') || o.includes('duckdb')) return null;
    return ADAPTER_TO_PROVIDER[adapter] || null;
  }

  function fetchDetectedSources(container, platformGrid, oauthResult) {
    return api('GET', '/api/sources').then(function (data) {
      var sources = data.sources || data || [];
      container.textContent = '';
      if (sources.length === 0) {
        updateDbStatus(null);
        return;
      }

      // Group detected sources by provider
      var byProvider = {};
      var localFiles = [];
      sources.forEach(function (src) {
        var prov = providerFromOrigin(src.origin, src.adapter);
        if (!prov) {
          localFiles.push(src);
        } else {
          byProvider[prov] = byProvider[prov] || [];
          byProvider[prov].push(src);
        }
      });

      // Show detected hint banner
      var hint = createElement('div', { className: 'detected-hint' });
      var hintIcon = createElement('span', { className: 'detected-hint-icon', textContent: '\u{1F50D}' });
      var provNames = Object.keys(byProvider);
      var hintText;
      if (provNames.length > 0) {
        var names = provNames.map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); });
        hintText = 'We detected ' + names.join(', ') + ' in your IDE configs. Click a provider below to connect securely via OAuth.';
      } else {
        hintText = 'We detected local database files. Use manual connection or select a provider below.';
      }
      hint.appendChild(hintIcon);
      hint.appendChild(createElement('span', { textContent: hintText }));
      container.appendChild(hint);

      // For local files (duckdb, sqlite), show direct-use cards
      localFiles.forEach(function (src) {
        var card = createElement('div', { className: 'source-card source-card-local' }, [
          createElement('span', { className: 'source-card-name', textContent: src.name || src.adapter }),
          createElement('span', { className: 'source-card-meta', textContent: 'Local file' }),
          createElement('button', { className: 'btn btn-primary', textContent: 'Use This' }),
        ]);
        card.querySelector('.btn').addEventListener('click', function () {
          state.sources = state.sources || [];
          state.sources.push(src);
          saveState();
          updateDbStatus(src);
          goToStep(2);
        });
        container.appendChild(card);
      });

      // Highlight matching providers in the platform grid
      state._detectedProviders = provNames;

    }).catch(function () {
      container.textContent = '';
      updateDbStatus(null);
    });
  }

  function fetchAuthProviders(container, oauthResult) {
    api('GET', '/api/auth/providers').then(function (data) {
      var providers = data.providers || data || [];
      // Replace the platform-grid with a plain wrapper for mixed content
      var wrapper = createElement('div', { className: 'connect-providers' });
      container.replaceWith(wrapper);

      if (providers.length === 0) {
        wrapper.appendChild(createElement('p', { className: 'muted', textContent: 'No OAuth providers available.' }));
        return;
      }

      var detected = state._detectedProviders || [];

      // Show detected providers first (highlighted)
      var detectedProvs = [];
      var otherProvs = [];
      providers.forEach(function (prov) {
        if (detected.indexOf(prov.id) !== -1) {
          detectedProvs.push(prov);
        } else {
          otherProvs.push(prov);
        }
      });

      // Detected providers get prominent cards
      if (detectedProvs.length > 0) {
        var detectedGrid = createElement('div', { className: 'source-cards' });
        detectedProvs.forEach(function (prov) {
          var card = createElement('div', { className: 'source-card source-card-detected' }, [
            createElement('span', { className: 'source-card-badge', textContent: 'Detected' }),
            createElement('span', { className: 'source-card-name', textContent: prov.displayName || prov.display_name || prov.id }),
            createElement('span', { className: 'source-card-meta', textContent: (prov.cliAuthenticated ? 'CLI authenticated' : prov.cliInstalled ? 'CLI installed' : 'OAuth available') }),
            createElement('button', { className: 'btn btn-primary', textContent: 'Connect via OAuth' }),
          ]);
          card.querySelector('.btn').addEventListener('click', function () {
            startOAuthFlow(prov, wrapper, oauthResult);
          });
          detectedGrid.appendChild(card);
        });
        wrapper.appendChild(detectedGrid);

        if (otherProvs.length > 0) {
          wrapper.appendChild(createElement('div', { className: 'section-divider' }, ['Other providers']));
        }
      }

      // Other providers as button grid
      if (otherProvs.length > 0) {
        var grid = createElement('div', { className: 'platform-grid' });
        otherProvs.forEach(function (prov) {
          var btn = createElement('button', { className: 'platform-btn', textContent: prov.displayName || prov.display_name || prov.name || prov.id });
          btn.addEventListener('click', function () {
            startOAuthFlow(prov, wrapper, oauthResult);
          });
          grid.appendChild(btn);
        });
        wrapper.appendChild(grid);
      }
    }).catch(function () {
      container.textContent = '';
      container.appendChild(createElement('p', { className: 'muted', textContent: 'Could not load providers.' }));
    });
  }

  async function startOAuthFlow(provider, providerWrapper, oauthResult) {
    // Disable all buttons
    providerWrapper.querySelectorAll('.platform-btn').forEach(function (b) { b.disabled = true; });
    providerWrapper.querySelectorAll('.source-card .btn').forEach(function (b) { b.disabled = true; });

    // Show loading in the oauth result area (right after detected cards)
    oauthResult.textContent = '';
    oauthResult.appendChild(createElement('p', { className: 'muted', textContent: 'Connecting to ' + (provider.displayName || provider.display_name || provider.id) + '\u2026 A browser window may open for authentication.' }));

    try {
      var data = await api('POST', '/api/auth/start', { provider: provider.id });
      var databases = data.databases || data || [];
      oauthResult.textContent = '';

      if (databases.length === 0) {
        oauthResult.appendChild(createElement('p', { className: 'muted', textContent: 'No databases found for this provider.' }));
        providerWrapper.querySelectorAll('.platform-btn').forEach(function (b) { b.disabled = false; });
        providerWrapper.querySelectorAll('.source-card .btn').forEach(function (b) { b.disabled = false; });
        return;
      }

      // Hide the other providers / platform grid — show only database results
      providerWrapper.style.display = 'none';

      var oauthHeader = createElement('div', { className: 'oauth-result-header' });
      oauthHeader.appendChild(createElement('label', { className: 'label-uppercase', textContent: 'Select a database from ' + (provider.displayName || provider.display_name || provider.id) }));
      var backLink = createElement('button', { className: 'btn btn-secondary btn-sm', textContent: '\u2190 Back to providers' });
      backLink.addEventListener('click', function () {
        oauthResult.textContent = '';
        providerWrapper.style.display = '';
        providerWrapper.querySelectorAll('.platform-btn').forEach(function (b) { b.disabled = false; });
        providerWrapper.querySelectorAll('.source-card .btn').forEach(function (b) { b.disabled = false; });
      });
      oauthHeader.appendChild(backLink);
      oauthResult.appendChild(oauthHeader);

      var dbGrid = createElement('div', { className: 'source-cards' });
      databases.forEach(function (db) {
        var m = db.metadata || {};
        // Title: "project / branch" if available, else just db name
        var title = m.project ? m.project + ' / ' + (m.branch || 'main') : (db.name || db.database);
        // Subtitle line 1: db name + adapter + region + org
        var parts = [db.name || db.database];
        if (db.adapter) parts.push(db.adapter);
        if (m.region) parts.push(m.region);
        if (m.org && m.org !== 'Personal') parts.push(m.org);
        else if (m.org === 'Personal') parts.push('personal');
        var line1 = parts.join(' \u2022 ');
        // Subtitle line 2: host (truncated)
        var line2 = db.host || '';

        var dbCard = createElement('div', { className: 'source-card' }, [
          createElement('span', { className: 'source-card-name', textContent: title }),
          createElement('span', { className: 'source-card-meta', textContent: line1 }),
          line2 ? createElement('span', { className: 'source-card-host', textContent: line2 }) : null,
          createElement('button', { className: 'btn btn-primary', textContent: 'Use This' }),
        ].filter(Boolean));
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
      providerWrapper.querySelectorAll('.platform-btn').forEach(function (b) { b.disabled = false; });
      providerWrapper.querySelectorAll('.source-card .btn').forEach(function (b) { b.disabled = false; });
    }
  }

  // ---- Step 2: Define ----

  function renderDefineStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card' });

    card.appendChild(createElement('h2', { textContent: 'Define Your Data Product' }));
    card.appendChild(createElement('p', { className: 'muted', textContent: 'Tell us about your data product. This metadata helps AI agents understand what they\u2019re working with.' }));

    var form = createElement('div', { className: 'define-form' });

    // Product Name (full width, required)
    var nameGroup = createElement('div', { className: 'field full-width' });
    nameGroup.appendChild(createElement('label', { htmlFor: 'product_name', textContent: 'Product Name *' }));
    nameGroup.appendChild(createElement('input', {
      className: 'input',
      id: 'product_name',
      type: 'text',
      placeholder: 'my-data-product',
    }));
    nameGroup.appendChild(createElement('p', { className: 'hint', textContent: 'Alphanumeric, hyphens, and underscores only.' }));
    form.appendChild(nameGroup);

    // Description (full width, required)
    var descGroup = createElement('div', { className: 'field full-width' });
    descGroup.appendChild(createElement('label', { htmlFor: 'description', textContent: 'Description *' }));
    var descInput = createElement('textarea', {
      className: 'textarea',
      id: 'description',
      placeholder: 'What does this data product provide?',
    });
    descGroup.appendChild(descInput);
    form.appendChild(descGroup);

    // Owner Name (left column)
    var ownerNameGroup = createElement('div', { className: 'field' });
    ownerNameGroup.appendChild(createElement('label', { htmlFor: 'owner_name', textContent: 'Owner Name' }));
    ownerNameGroup.appendChild(createElement('input', {
      className: 'input',
      id: 'owner_name',
      type: 'text',
      placeholder: 'Jane Doe',
    }));
    form.appendChild(ownerNameGroup);

    // Team (right column)
    var teamGroup = createElement('div', { className: 'field' });
    teamGroup.appendChild(createElement('label', { htmlFor: 'owner_team', textContent: 'Team' }));
    teamGroup.appendChild(createElement('input', {
      className: 'input',
      id: 'owner_team',
      type: 'text',
      placeholder: 'Data Engineering',
    }));
    form.appendChild(teamGroup);

    // Email (left column)
    var emailGroup = createElement('div', { className: 'field' });
    emailGroup.appendChild(createElement('label', { htmlFor: 'owner_email', textContent: 'Email' }));
    emailGroup.appendChild(createElement('input', {
      className: 'input',
      id: 'owner_email',
      type: 'text',
      placeholder: 'jane@example.com',
    }));
    form.appendChild(emailGroup);

    // Sensitivity (right column)
    var sensGroup = createElement('div', { className: 'field' });
    sensGroup.appendChild(createElement('label', { htmlFor: 'sensitivity', textContent: 'Sensitivity' }));
    var sensSelect = createElement('select', { className: 'select', id: 'sensitivity' });
    [
      { value: 'public', text: 'Public' },
      { value: 'internal', text: 'Internal' },
      { value: 'confidential', text: 'Confidential' },
      { value: 'restricted', text: 'Restricted' },
    ].forEach(function (opt) {
      var option = createElement('option', { value: opt.value, textContent: opt.text });
      sensSelect.appendChild(option);
    });
    sensSelect.value = 'internal';
    sensGroup.appendChild(sensSelect);
    form.appendChild(sensGroup);

    // Action buttons (full width)
    var actions = createElement('div', { className: 'define-actions' });

    var backBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Back' });
    backBtn.addEventListener('click', function () { goToStep(1); });
    actions.appendChild(backBtn);

    var continueBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Continue' });
    continueBtn.addEventListener('click', async function () {
      clearErrors();
      var valid = true;

      var productName = document.getElementById('product_name').value.trim();
      var description = document.getElementById('description').value.trim();

      if (!productName) {
        showError('product_name', 'Product name is required.');
        valid = false;
      } else if (!/^[a-zA-Z0-9_-]+$/.test(productName)) {
        showError('product_name', 'Only letters, numbers, hyphens, and underscores allowed.');
        valid = false;
      }

      if (!description) {
        showError('description', 'Description is required.');
        valid = false;
      }

      if (!valid) return;

      state.brief.product_name = productName;
      state.brief.description = description;
      state.brief.owner.name = document.getElementById('owner_name').value.trim();
      state.brief.owner.team = document.getElementById('owner_team').value.trim();
      state.brief.owner.email = document.getElementById('owner_email').value.trim();
      state.brief.sensitivity = document.getElementById('sensitivity').value;
      saveState();

      continueBtn.textContent = 'Saving\u2026';
      continueBtn.disabled = true;
      try {
        await api('POST', '/api/brief', state.brief);
        goToStep(3);
      } catch (e) {
        continueBtn.textContent = 'Continue';
        continueBtn.disabled = false;
        var errP = createElement('p', { className: 'field-error', textContent: e.message || 'Failed to save. Please try again.' });
        actions.appendChild(errP);
      }
    });
    actions.appendChild(continueBtn);
    form.appendChild(actions);

    card.appendChild(form);
    content.appendChild(card);

    // Pre-fill from saved state first
    if (state.brief.product_name) document.getElementById('product_name').value = state.brief.product_name;
    if (state.brief.description) document.getElementById('description').value = state.brief.description;
    if (state.brief.owner.name) document.getElementById('owner_name').value = state.brief.owner.name;
    if (state.brief.owner.team) document.getElementById('owner_team').value = state.brief.owner.team;
    if (state.brief.owner.email) document.getElementById('owner_email').value = state.brief.owner.email;
    if (state.brief.sensitivity) document.getElementById('sensitivity').value = state.brief.sensitivity;

    // Auto-suggest from selected source (if fields are still empty)
    var hasAnyField = state.brief.product_name || state.brief.description || state.brief.owner.name;
    if (!hasAnyField && state.sources && state.sources.length > 0) {
      var suggestNote = createElement('p', { className: 'muted suggest-loading', textContent: 'Auto-filling from your database\u2026' });
      card.insertBefore(suggestNote, form);

      api('POST', '/api/suggest-brief', { source: state.sources[0] }).then(function (data) {
        suggestNote.remove();
        // Only fill empty fields
        var fields = [
          { id: 'product_name', val: data.product_name, stateKey: 'product_name' },
          { id: 'description', val: data.description, stateKey: 'description' },
          { id: 'owner_name', val: data.owner && data.owner.name, stateKey: null },
          { id: 'owner_team', val: data.owner && data.owner.team, stateKey: null },
          { id: 'owner_email', val: data.owner && data.owner.email, stateKey: null },
          { id: 'sensitivity', val: data.sensitivity, stateKey: 'sensitivity' },
        ];
        fields.forEach(function (f) {
          var el = document.getElementById(f.id);
          if (el && !el.value && f.val) {
            el.value = f.val;
          }
        });
      }).catch(function () {
        suggestNote.textContent = '';
      });
    }
  }

  // ---- Step 3: Scaffold ----

  var SCAFFOLD_STAGES = [
    { key: 'introspect', label: 'Extracting schema from database...' },
    { key: 'scaffold', label: 'Building semantic plane files...' },
    { key: 'verify', label: 'Validating semantic plane...' },
    { key: 'autofix', label: 'Fixing any issues...' },
    { key: 'agent-instructions', label: 'Generating agent instructions...' },
  ];

  function renderScaffoldStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card' });

    card.appendChild(createElement('h2', { textContent: 'Building Your Semantic Plane' }));
    card.appendChild(createElement('p', { className: 'muted', textContent: 'Connecting to your database and extracting schema metadata. This creates a Bronze-tier semantic plane.' }));

    // Stage rows container
    var stagesContainer = createElement('div', { className: 'scaffold-stages', id: 'scaffold-stages' });
    SCAFFOLD_STAGES.forEach(function (stage) {
      var row = createElement('div', { className: 'stage-row', id: 'stage-' + stage.key, 'data-stage': stage.key }, [
        createElement('span', { className: 'stage-dot' }),
        createElement('span', { className: 'stage-name', textContent: stage.label }),
      ]);
      stagesContainer.appendChild(row);
    });
    card.appendChild(stagesContainer);

    // Error area
    var errorArea = createElement('div', { id: 'scaffold-error' });
    card.appendChild(errorArea);

    // Action area (Start / Retry button)
    var actionArea = createElement('div', { className: 'step-actions', id: 'scaffold-actions' });

    var backBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Back' });
    backBtn.addEventListener('click', function () { goToStep(2); });
    actionArea.appendChild(backBtn);

    // If we already have a pipelineId, resume polling; otherwise show Start button
    if (state.pipelineId) {
      actionArea.appendChild(createElement('span', { className: 'muted', textContent: 'Build in progress...' }));
      card.appendChild(actionArea);
      content.appendChild(card);
      startScaffoldPolling();
    } else {
      var startBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Start Build', id: 'scaffold-start-btn' });
      startBtn.addEventListener('click', function () { startScaffoldBuild(startBtn); });
      actionArea.appendChild(startBtn);
      card.appendChild(actionArea);
      content.appendChild(card);
    }
  }

  async function startScaffoldBuild(btn) {
    btn.textContent = 'Starting...';
    btn.disabled = true;

    var errorArea = document.getElementById('scaffold-error');
    if (errorArea) errorArea.textContent = '';

    var body = {
      productName: state.brief.product_name,
      targetTier: 'bronze',
    };
    if (state.sources && state.sources[0]) {
      body.dataSource = state.sources[0];
    }

    try {
      var result = await api('POST', '/api/pipeline/start', body);
      state.pipelineId = result.id;
      saveState();
      btn.textContent = 'Building...';
      startScaffoldPolling();
    } catch (e) {
      btn.textContent = 'Start Build';
      btn.disabled = false;
      var errorArea = document.getElementById('scaffold-error');
      if (errorArea) {
        errorArea.textContent = '';
        errorArea.appendChild(createElement('p', { className: 'field-error', textContent: e.message || 'Failed to start build.' }));
      }
    }
  }

  function startScaffoldPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }

    async function poll() {
      if (!state.pipelineId) return;
      try {
        var status = await api('GET', '/api/pipeline/status/' + state.pipelineId);
        var stages = status.stages || [];
        var hasError = false;
        var allDone = true;

        SCAFFOLD_STAGES.forEach(function (def) {
          var row = document.getElementById('stage-' + def.key);
          if (!row) return;

          var match = null;
          for (var i = 0; i < stages.length; i++) {
            if (stages[i].name === def.key) { match = stages[i]; break; }
          }

          var dot = row.querySelector('.stage-dot');
          // Reset classes
          dot.className = 'stage-dot';

          // Remove any previous summary/error elements
          var oldSummary = row.querySelector('.stage-summary');
          if (oldSummary) oldSummary.remove();
          var oldError = row.querySelector('.stage-error');
          if (oldError) oldError.remove();

          if (!match || match.status === 'pending') {
            allDone = false;
          } else if (match.status === 'running') {
            dot.classList.add('running');
            allDone = false;
          } else if (match.status === 'done') {
            dot.classList.add('done');
            if (match.summary) {
              row.appendChild(createElement('span', { className: 'stage-summary', textContent: match.summary }));
            }
          } else if (match.status === 'error') {
            dot.classList.add('error');
            hasError = true;
            allDone = false;
            if (match.error) {
              row.appendChild(createElement('span', { className: 'stage-error', textContent: match.error }));
            }
          }
        });

        if (hasError) {
          if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
          showScaffoldError(status.error || 'A pipeline stage failed.');
        } else if (allDone && stages.length > 0) {
          if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
          goToStep(4);
        }
      } catch (e) {
        // Network error — keep polling, it may recover
      }
    }

    poll();
    state.pollTimer = setInterval(poll, 2000);
  }

  function showScaffoldError(msg) {
    var errorArea = document.getElementById('scaffold-error');
    if (!errorArea) return;
    errorArea.textContent = '';
    errorArea.appendChild(createElement('p', { className: 'field-error', textContent: msg }));

    var actions = document.getElementById('scaffold-actions');
    if (!actions) return;
    // Remove old start/building button if any
    var oldBtn = actions.querySelector('.btn-primary');
    if (oldBtn) oldBtn.remove();
    var oldMuted = actions.querySelector('.muted');
    if (oldMuted) oldMuted.remove();

    var retryBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Retry' });
    retryBtn.addEventListener('click', function () {
      state.pipelineId = null;
      saveState();
      // Reset stage dots
      SCAFFOLD_STAGES.forEach(function (def) {
        var row = document.getElementById('stage-' + def.key);
        if (!row) return;
        var dot = row.querySelector('.stage-dot');
        if (dot) dot.className = 'stage-dot';
        var s = row.querySelector('.stage-summary');
        if (s) s.remove();
        var e = row.querySelector('.stage-error');
        if (e) e.remove();
      });
      errorArea.textContent = '';
      startScaffoldBuild(retryBtn);
    });
    actions.appendChild(retryBtn);
  }

  // ---- Step 4: Checkpoint ----

  function renderCheckpointStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card checkpoint-card' });

    card.appendChild(createElement('h2', { textContent: 'Bronze Tier Achieved' }));

    // Tier scorecard
    var scorecard = createElement('div', { className: 'tier-scorecard' });

    // Bronze (achieved)
    var bronzeRow = createElement('div', { className: 'tier-row achieved' }, [
      createElement('span', { className: 'tier-label', textContent: 'Bronze' }),
      createElement('span', { className: 'tier-desc', textContent: 'Schema metadata, table/column names, types, row counts' }),
    ]);
    scorecard.appendChild(bronzeRow);

    // Silver
    var silverRow = createElement('div', { className: 'tier-row' }, [
      createElement('span', { className: 'tier-label', textContent: 'Silver' }),
      createElement('span', { className: 'tier-desc', textContent: 'Column descriptions, sample values, trust tags' }),
    ]);
    scorecard.appendChild(silverRow);

    // Gold
    var goldRow = createElement('div', { className: 'tier-row' }, [
      createElement('span', { className: 'tier-label', textContent: 'Gold' }),
      createElement('span', { className: 'tier-desc', textContent: 'Join rules, grain statements, semantic roles, golden queries, guardrail filters' }),
    ]);
    scorecard.appendChild(goldRow);

    card.appendChild(scorecard);

    // Explanatory text
    card.appendChild(createElement('p', { className: 'checkpoint-explain', textContent: 'Your semantic plane has basic schema metadata. AI tools can use this now, but with Gold tier they\'ll understand join relationships, business descriptions, and query patterns.' }));

    // CTA buttons
    var ctas = createElement('div', { className: 'checkpoint-ctas' });

    var serveBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Start MCP Server' });
    serveBtn.addEventListener('click', function () { goToStep(6); });
    ctas.appendChild(serveBtn);

    var goldBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Continue to Gold' });
    goldBtn.addEventListener('click', function () { goToStep(5); });
    ctas.appendChild(goldBtn);

    card.appendChild(ctas);
    content.appendChild(card);
  }

  // ---- Step 5: Enrich ----

  var ENRICH_REQUIREMENTS = [
    { key: 'column-descriptions', label: 'Column descriptions', initial: '0/45 columns' },
    { key: 'sample-values', label: 'Sample values', initial: '0/45 columns' },
    { key: 'join-rules', label: 'Join rules', initial: '0/0' },
    { key: 'grain-statements', label: 'Grain statements', initial: '0/0' },
    { key: 'semantic-roles', label: 'Semantic roles', initial: '0/0' },
    { key: 'golden-queries', label: 'Golden queries', initial: '0/0' },
    { key: 'guardrail-filters', label: 'Guardrail filters', initial: '0/0' },
  ];

  function renderEnrichStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card' });

    card.appendChild(createElement('h2', { textContent: 'Enriching to Gold' }));
    card.appendChild(createElement('p', { className: 'muted', textContent: 'RunContext is analyzing your schema to add descriptions, join rules, and query patterns.' }));

    // Start Enrichment button area
    var startArea = createElement('div', { className: 'step-actions', id: 'enrich-start-area' });
    var backBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Back' });
    backBtn.addEventListener('click', function () { goToStep(4); });
    startArea.appendChild(backBtn);

    var startBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Start Enrichment', id: 'enrich-start-btn' });
    startBtn.addEventListener('click', function () { startEnrichment(startBtn); });
    startArea.appendChild(startBtn);
    card.appendChild(startArea);

    // Dashboard (always visible — shows checklist pre-enrichment)
    var dashboard = createElement('div', { className: 'enrich-dashboard', id: 'enrich-dashboard' });

    // Top panel: Requirements checklist
    var checklist = createElement('div', { className: 'enrich-checklist' });
    ENRICH_REQUIREMENTS.forEach(function (req) {
      var row = createElement('div', { className: 'enrich-row', id: 'enrich-req-' + req.key });

      var header = createElement('div', { className: 'enrich-row-header' });
      header.appendChild(createElement('span', { className: 'stage-dot' }));
      header.appendChild(createElement('span', { className: 'enrich-req-name', textContent: req.label }));
      header.appendChild(createElement('span', { className: 'enrich-progress', textContent: req.initial }));
      header.appendChild(createElement('span', { className: 'enrich-arrow', textContent: '\u25B6' }));

      header.addEventListener('click', function () {
        row.classList.toggle('expanded');
      });

      var detail = createElement('div', { className: 'enrich-row-detail' }, [
        'Details will appear as enrichment progresses.',
      ]);

      row.appendChild(header);
      row.appendChild(detail);
      checklist.appendChild(row);
    });
    dashboard.appendChild(checklist);

    // Bottom panel: Activity log
    var logSection = createElement('div', { className: 'activity-log' });
    logSection.appendChild(createElement('div', { className: 'activity-log-title', textContent: 'Activity Log' }));
    var logContainer = createElement('div', { id: 'activity-log' });
    logContainer.appendChild(createElement('div', { className: 'log-entry' }, [
      createElement('span', { className: 'log-time', textContent: new Date().toLocaleTimeString() }),
      createElement('span', {}, [' Waiting for enrichment to start...']),
    ]));
    logSection.appendChild(logContainer);
    dashboard.appendChild(logSection);

    // Error area
    var errorArea = createElement('div', { id: 'enrich-error' });
    dashboard.appendChild(errorArea);

    card.appendChild(dashboard);
    content.appendChild(card);
  }

  async function startEnrichment(btn) {
    btn.textContent = 'Starting...';
    btn.disabled = true;

    var errorArea = document.getElementById('enrich-error');
    if (errorArea) errorArea.textContent = '';

    var body = {
      productName: state.brief.product_name,
      targetTier: 'gold',
    };
    if (state.sources && state.sources[0]) {
      body.dataSource = state.sources[0];
    }

    try {
      var result = await api('POST', '/api/pipeline/start', body);
      state.pipelineId = result.id;
      saveState();

      // Hide start button area
      var startArea = document.getElementById('enrich-start-area');
      if (startArea) startArea.style.display = 'none';

      appendEnrichLog({ message: 'Enrichment pipeline started.' });
      startEnrichPolling();
    } catch (e) {
      btn.textContent = 'Start Enrichment';
      btn.disabled = false;
      if (errorArea) {
        errorArea.textContent = '';
        errorArea.appendChild(createElement('p', { className: 'field-error', textContent: e.message || 'Failed to start enrichment.' }));
      }
    }
  }

  function startEnrichPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }

    async function poll() {
      if (!state.pipelineId) return;
      try {
        var status = await api('GET', '/api/pipeline/status/' + state.pipelineId);
        var stages = status.stages || [];
        var hasError = false;
        var silverDone = false;
        var goldDone = false;

        for (var i = 0; i < stages.length; i++) {
          var s = stages[i];
          if (s.name === 'enrich-silver' && s.status === 'done') silverDone = true;
          if (s.name === 'enrich-gold' && s.status === 'done') goldDone = true;
          if (s.status === 'error') hasError = true;
        }

        if (hasError) {
          if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
          showEnrichError(status.error || 'An enrichment stage failed.');
          return;
        }

        if (silverDone) {
          appendEnrichLog({ message: 'Silver enrichment complete.' });
        }
        if (silverDone && goldDone) {
          if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
          appendEnrichLog({ message: 'Gold enrichment complete! Advancing...' });
          goToStep(6);
        }
      } catch (e) {
        // Network error — keep polling
      }
    }

    poll();
    state.pollTimer = setInterval(poll, 3000);
  }

  function showEnrichError(msg) {
    var errorArea = document.getElementById('enrich-error');
    if (!errorArea) return;
    errorArea.textContent = '';
    errorArea.appendChild(createElement('p', { className: 'field-error', textContent: msg }));

    var retryBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Retry' });
    retryBtn.addEventListener('click', function () {
      errorArea.textContent = '';
      state.pipelineId = null;
      saveState();
      // Reset requirement rows to pending
      ENRICH_REQUIREMENTS.forEach(function (req) {
        var row = document.getElementById('enrich-req-' + req.key);
        if (!row) return;
        var dot = row.querySelector('.stage-dot');
        if (dot) dot.className = 'stage-dot';
        var prog = row.querySelector('.enrich-progress');
        if (prog) prog.textContent = req.initial;
      });
      // Show start area again, hide dashboard
      var startArea = document.getElementById('enrich-start-area');
      if (startArea) startArea.style.display = '';
      var dashboard = document.getElementById('enrich-dashboard');
      if (dashboard) dashboard.style.display = 'none';
      var startBtn = document.getElementById('enrich-start-btn');
      if (startBtn) {
        startBtn.textContent = 'Start Enrichment';
        startBtn.disabled = false;
      }
    });
    errorArea.appendChild(retryBtn);
  }

  function updateEnrichProgress(payload) {
    // payload: { requirement: string, status: string, progress: string }
    var row = document.getElementById('enrich-req-' + payload.requirement);
    if (!row) return;
    var dot = row.querySelector('.stage-dot');
    var prog = row.querySelector('.enrich-progress');
    if (dot) {
      dot.className = 'stage-dot' + (payload.status === 'working' ? ' running' : payload.status === 'done' ? ' done' : '');
    }
    if (prog) prog.textContent = payload.progress || '';
  }

  function appendEnrichLog(payload) {
    // payload: { message: string, timestamp?: string }
    var log = document.getElementById('activity-log');
    if (!log) return;
    var ts = payload.timestamp ? new Date(payload.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    var entry = createElement('div', { className: 'log-entry' }, [
      createElement('span', { className: 'log-time' }, [ts]),
      createElement('span', {}, [' ' + payload.message]),
    ]);
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  // ---- Step 6: Serve ----

  function renderServeStep() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card serve-card' });

    card.appendChild(createElement('h2', { textContent: 'Your Semantic Plane is Ready' }));

    // Tier detection placeholder — will be filled async
    var tierBadge = createElement('span', { className: 'serve-tier-badge bronze', id: 'tier-badge', textContent: 'Bronze' });
    card.appendChild(tierBadge);

    var messageEl = createElement('p', { className: 'muted' });
    messageEl.textContent = 'Your Bronze tier semantic plane is ready for AI agents.';
    card.appendChild(messageEl);

    var upgradeHint = createElement('p', { className: 'muted' });
    upgradeHint.style.marginTop = '8px';
    upgradeHint.style.display = 'none';
    card.appendChild(upgradeHint);

    // Fetch tier from pipeline status
    if (state.pipelineId) {
      fetch('/api/pipeline/status/' + state.pipelineId)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var stages = data.stages || [];
          var tier = 'Bronze';
          var tierClass = 'bronze';
          var hasSilver = false;
          var hasGold = false;
          for (var i = 0; i < stages.length; i++) {
            if (stages[i].name === 'enrich-gold' && stages[i].status === 'done') {
              hasGold = true;
            }
            if (stages[i].name === 'enrich-silver' && stages[i].status === 'done') {
              hasSilver = true;
            }
          }
          if (hasGold) {
            tier = 'Gold';
            tierClass = 'gold';
          } else if (hasSilver) {
            tier = 'Silver';
            tierClass = 'silver';
          }

          tierBadge.className = 'serve-tier-badge ' + tierClass;
          tierBadge.textContent = tier;
          messageEl.textContent = 'Your ' + tier + ' tier semantic plane is ready for AI agents.';

          if (!hasGold) {
            var missing = [];
            if (!hasSilver) missing.push('Silver enrichment');
            missing.push('Gold enrichment');
            upgradeHint.textContent = 'To reach Gold, you still need: ' + missing.join(', ') + '. You can run enrichment later with `context enrich --target gold`.';
            upgradeHint.style.display = 'block';
          }
        })
        .catch(function () { /* keep Bronze default */ });
    }

    // CTAs
    var ctas = createElement('div', { className: 'serve-ctas' });

    var startBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Start MCP Server' });
    startBtn.addEventListener('click', function () {
      startBtn.disabled = true;
      startBtn.textContent = 'Loading...';
      fetch('/api/mcp-config')
        .then(function (res) { return res.json(); })
        .then(function (config) {
          startBtn.textContent = 'Start MCP Server';
          startBtn.disabled = false;
          // Remove existing config block if any
          var existing = card.querySelector('.mcp-config-block');
          if (existing) existing.remove();
          var configBlock = createElement('div', { className: 'mcp-config-block' });
          configBlock.textContent = JSON.stringify(config, null, 2);
          // Insert after CTAs
          var ctaParent = ctas.parentNode;
          if (ctaParent) ctaParent.insertBefore(configBlock, ctas.nextSibling);

          var copyHint = card.querySelector('.mcp-copy-hint');
          if (!copyHint) {
            copyHint = createElement('p', { className: 'muted mcp-copy-hint' });
            copyHint.textContent = 'Copy the JSON above into your IDE\'s MCP settings, or run: context serve';
            copyHint.style.marginTop = '8px';
            copyHint.style.fontSize = '0.85rem';
            var configEl = card.querySelector('.mcp-config-block');
            if (configEl && configEl.nextSibling) {
              ctaParent.insertBefore(copyHint, configEl.nextSibling);
            } else if (configEl) {
              ctaParent.appendChild(copyHint);
            }
          }
        })
        .catch(function () {
          startBtn.textContent = 'Start MCP Server';
          startBtn.disabled = false;
        });
    });
    ctas.appendChild(startBtn);

    var publishBtn = createElement('button', { className: 'btn btn-secondary', textContent: 'Publish to Cloud' });
    publishBtn.disabled = true;
    publishBtn.title = 'Coming soon';
    ctas.appendChild(publishBtn);

    card.appendChild(ctas);

    // CLI Commands section
    var cmds = createElement('div', { className: 'serve-commands' });
    cmds.appendChild(createElement('div', { className: 'serve-commands-title', textContent: 'CLI Commands' }));

    var cmdData = [
      ['context serve', 'Start the MCP server'],
      ['context tier', 'Check your current tier'],
      ['context enrich --target gold', 'Enrich to Gold tier'],
      ['context verify', 'Validate your semantic plane'],
    ];
    for (var i = 0; i < cmdData.length; i++) {
      var row = createElement('div', { className: 'serve-cmd-row' }, [
        createElement('span', { className: 'serve-cmd', textContent: cmdData[i][0] }),
        createElement('span', { className: 'serve-cmd-desc', textContent: cmdData[i][1] }),
      ]);
      cmds.appendChild(row);
    }
    card.appendChild(cmds);

    // Continue Enrichment link (shown if not Gold — updated async)
    var continueLink = createElement('p', {});
    continueLink.style.marginTop = '16px';
    var linkEl = createElement('a', { textContent: 'Continue Enrichment' });
    linkEl.style.color = 'var(--rc-color-accent, #c9a55a)';
    linkEl.style.cursor = 'pointer';
    linkEl.style.fontSize = '0.875rem';
    linkEl.addEventListener('click', function () {
      goToStep(5);
    });
    continueLink.appendChild(linkEl);
    card.appendChild(continueLink);

    // Hide continue link if Gold
    if (state.pipelineId) {
      fetch('/api/pipeline/status/' + state.pipelineId)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var stages = data.stages || [];
          for (var j = 0; j < stages.length; j++) {
            if (stages[j].name === 'enrich-gold' && stages[j].status === 'done') {
              continueLink.style.display = 'none';
              break;
            }
          }
        })
        .catch(function () { /* keep visible */ });
    }

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
      var serverDot = document.getElementById('mcp-server-dot');
      var serverText = document.getElementById('mcp-server-text');
      if (!dot || !text) return;
      try {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 2000);
        var res = await fetch('http://localhost:3333/health', {
          method: 'GET',
          mode: 'no-cors',
          signal: controller.signal,
        });
        clearTimeout(timer);
        // mode: 'no-cors' returns opaque response (status 0) but means server is reachable
        dot.classList.remove('error');
        dot.classList.add('success');
        text.textContent = 'connected';
        if (serverDot) { serverDot.classList.remove('error'); serverDot.classList.add('success'); }
        if (serverText) serverText.textContent = 'MCP running';
      } catch (e) {
        dot.classList.remove('success');
        text.textContent = 'offline';
        if (serverDot) { serverDot.classList.remove('success'); }
        if (serverText) serverText.textContent = 'MCP stopped';
      }
    }
    check();
    state.mcpPollTimer = setInterval(check, 10000);
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

    // Restore DB status from saved state
    if (state.sources && state.sources.length > 0) {
      updateDbStatus(state.sources[0]);
    }

    goToStep(state.step);

    // Create or resume a WebSocket session
    var urlParams = new URLSearchParams(window.location.search);
    var sessionParam = urlParams.get('session');
    if (sessionParam) {
      connectWebSocket(sessionParam);
    } else {
      fetch('/api/session', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.sessionId) {
            connectWebSocket(data.sessionId);
            // Update URL without reload so session persists on refresh
            var newUrl = window.location.pathname + '?session=' + encodeURIComponent(data.sessionId);
            window.history.replaceState({}, '', newUrl);
          }
        })
        .catch(function () { /* WebSocket is best-effort */ });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
