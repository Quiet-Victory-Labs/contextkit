(function () {
  'use strict';

  var STORAGE_KEY = 'runcontext_wizard_state';
  var STEP_LABELS = ['Product', 'Owner', 'Context', 'Review', 'Build'];

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

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

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
    if (n < 1 || n > 5) return;

    var content = document.getElementById('wizard-content');
    if (content) content.textContent = '';

    state.step = n;
    saveState();

    renderStepper();

    switch (n) {
      case 1: renderStep1(); break;
      case 2: renderStep2(); break;
      case 3: renderStep3(); break;
      case 4: renderStep4(); break;
      case 5: renderStep5(); break;
    }
  }

  function validateStep(n) {
    clearErrors();
    if (n === 1) {
      var name = $('#product-name').value.trim();
      if (!name) { showError('product-name', 'Product name is required'); return false; }
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) { showError('product-name', 'Only letters, numbers, dashes, underscores'); return false; }
      state.brief.product_name = name;
      state.brief.description = $('#description').value.trim();
      saveState();
      return true;
    }
    if (n === 2) {
      state.brief.owner.name = $('#owner-name').value.trim();
      state.brief.owner.team = $('#owner-team').value.trim();
      state.brief.owner.email = $('#owner-email').value.trim();
      saveState();
      return true;
    }
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

  // ---- Step 1: Product ----

  function renderStep1() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    // Check existing products banner first
    checkExistingProducts();

    var card = createElement('div', { className: 'card' });

    var heading = createElement('h2', { textContent: 'Define Your Data Product' });
    card.appendChild(heading);

    // Product name field
    var nameField = createElement('div', { className: 'field' });
    nameField.appendChild(createElement('label', { htmlFor: 'product-name', textContent: 'Product Name' }));
    var nameInput = createElement('input', {
      className: 'input',
      id: 'product-name',
      type: 'text',
      placeholder: 'e.g. customer-analytics',
    });
    nameField.appendChild(nameInput);
    nameField.appendChild(createElement('p', { className: 'hint', textContent: 'Letters, numbers, dashes, and underscores only.' }));
    card.appendChild(nameField);

    // Description field with voice button
    var descField = createElement('div', { className: 'field' });
    descField.appendChild(createElement('label', { htmlFor: 'description', textContent: 'Description' }));
    var textareaWrapper = createElement('div', { className: 'textarea-wrapper' });
    var textarea = createElement('textarea', {
      className: 'textarea',
      id: 'description',
      placeholder: 'Describe what this data product does...',
      rows: '4',
    });
    textareaWrapper.appendChild(textarea);
    var voiceBtn = createElement('button', { className: 'btn-icon', id: 'voice-btn', type: 'button', title: 'Voice input' });
    voiceBtn.textContent = '\uD83C\uDF99';
    textareaWrapper.appendChild(voiceBtn);
    descField.appendChild(textareaWrapper);
    card.appendChild(descField);

    card.appendChild(createStepActions(false, true));
    content.appendChild(card);

    // Restore values from state
    if (state.brief.product_name) {
      nameInput.value = state.brief.product_name;
    }
    if (state.brief.description) {
      textarea.value = state.brief.description;
    }

    setupVoice();
  }

  // ---- Step 2: Owner ----

  function renderStep2() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card' });
    card.appendChild(createElement('h2', { textContent: 'Owner Details' }));

    // Owner name
    var nameField = createElement('div', { className: 'field' });
    nameField.appendChild(createElement('label', { htmlFor: 'owner-name', textContent: 'Owner Name' }));
    var nameInput = createElement('input', {
      className: 'input',
      id: 'owner-name',
      type: 'text',
      placeholder: 'Jane Doe',
    });
    nameField.appendChild(nameInput);
    card.appendChild(nameField);

    // Team
    var teamField = createElement('div', { className: 'field' });
    teamField.appendChild(createElement('label', { htmlFor: 'owner-team', textContent: 'Team' }));
    var teamInput = createElement('input', {
      className: 'input',
      id: 'owner-team',
      type: 'text',
      placeholder: 'Data Engineering',
    });
    teamField.appendChild(teamInput);
    card.appendChild(teamField);

    // Email
    var emailField = createElement('div', { className: 'field' });
    emailField.appendChild(createElement('label', { htmlFor: 'owner-email', textContent: 'Email' }));
    var emailInput = createElement('input', {
      className: 'input',
      id: 'owner-email',
      type: 'email',
      placeholder: 'jane@company.com',
    });
    emailField.appendChild(emailInput);
    card.appendChild(emailField);

    card.appendChild(createStepActions(true, true));
    content.appendChild(card);

    // Restore values
    if (state.brief.owner.name) nameInput.value = state.brief.owner.name;
    if (state.brief.owner.team) teamInput.value = state.brief.owner.team;
    if (state.brief.owner.email) emailInput.value = state.brief.owner.email;
  }

  // ---- Step 3: Context (Sensitivity, Sources, Upload) ----

  function renderStep3() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card' });
    card.appendChild(createElement('h2', { textContent: 'Context & Sources' }));

    // Sensitivity section
    card.appendChild(createElement('label', { className: 'label-uppercase', textContent: 'Data Sensitivity' }));
    var sensCards = createElement('div', { className: 'sensitivity-cards' });

    var sensitivities = [
      { key: 'public', label: 'Public', desc: 'Openly available data with no access restrictions.' },
      { key: 'internal', label: 'Internal', desc: 'Company-internal data, not shared externally.' },
      { key: 'confidential', label: 'Confidential', desc: 'Restricted access, requires authorization.' },
      { key: 'restricted', label: 'Restricted', desc: 'Highly sensitive, regulatory or PII constraints.' },
    ];

    sensitivities.forEach(function (s) {
      var sensCard = createElement('div', { className: 'card', 'data-sensitivity': s.key }, [
        createElement('strong', { textContent: s.label }),
        createElement('p', { textContent: s.desc }),
      ]);
      if (state.brief.sensitivity === s.key) {
        sensCard.classList.add('selected');
      }
      sensCard.addEventListener('click', function () {
        sensCards.querySelectorAll('.card').forEach(function (c) { c.classList.remove('selected'); });
        sensCard.classList.add('selected');
        state.brief.sensitivity = s.key;
        saveState();
      });
      sensCards.appendChild(sensCard);
    });
    card.appendChild(sensCards);

    // Data sources section
    card.appendChild(createElement('label', { className: 'label-uppercase', textContent: 'Data Sources' }));
    var sourcesList = createElement('div', { id: 'sources-list', className: 'source-cards' });
    card.appendChild(sourcesList);

    // Upload section
    card.appendChild(createElement('label', { className: 'label-uppercase', textContent: 'Upload Documentation' }));
    var uploadArea = createElement('div', { className: 'upload-area', id: 'upload-area' }, [
      createElement('p', { textContent: 'Drag & drop files here or click to browse' }),
      createElement('p', { className: 'hint', textContent: 'Supports .md, .txt, .csv, .json, .yaml' }),
    ]);
    var fileInput = createElement('input', { type: 'file', id: 'file-input', multiple: 'true' });
    fileInput.style.display = 'none';
    card.appendChild(uploadArea);
    card.appendChild(fileInput);
    var uploadedFiles = createElement('div', { id: 'uploaded-files' });
    card.appendChild(uploadedFiles);

    card.appendChild(createStepActions(true, true));
    content.appendChild(card);

    // Setup upload interactions
    setupUpload();

    // Load sources
    loadSources();
  }

  // ---- Step 3: Sources & Upload logic ----

  async function loadSources() {
    var container = $('#sources-list');
    if (!container) return;
    container.textContent = '';
    container.appendChild(createElement('p', { className: 'muted', textContent: 'Detecting data sources...' }));
    try {
      var data = await api('GET', '/api/sources');
      state.sources = data.sources || data || [];
      container.textContent = '';
      if (state.sources.length === 0) {
        container.appendChild(createElement('p', { className: 'muted', textContent: 'No data sources detected in this directory.' }));
        updateDbStatus(null);
        return;
      }
      state.sources.forEach(function (src) {
        var card = createElement('div', { className: 'source-card' }, [
          createElement('span', { className: 'source-name', textContent: src.name || src.adapter }),
          createElement('span', { className: 'source-type', textContent: src.adapter || '' }),
          createElement('span', { className: 'source-status detected', textContent: 'Detected' }),
        ]);
        card.addEventListener('click', function () {
          container.querySelectorAll('.source-card').forEach(function (c) { c.classList.remove('selected'); });
          card.classList.add('selected');
          state.brief.data_source = src.adapter + ':' + (src.name || src.adapter);
          updateDbStatus(src);
        });
        container.appendChild(card);
      });
      // Auto-select if only one source detected
      if (state.sources.length === 1) {
        var only = container.querySelector('.source-card');
        if (only) only.click();
      }
    } catch (e) {
      container.textContent = '';
      container.appendChild(createElement('p', { className: 'muted', textContent: 'Could not detect sources.' }));
      updateDbStatus(null);
    }
  }

  function setupUpload() {
    var area = $('#upload-area');
    var input = $('#file-input');
    if (!area || !input) return;

    area.addEventListener('click', function () { input.click(); });

    area.addEventListener('dragover', function (e) {
      e.preventDefault();
      area.classList.add('dragover');
    });
    area.addEventListener('dragleave', function () {
      area.classList.remove('dragover');
    });
    area.addEventListener('drop', function (e) {
      e.preventDefault();
      area.classList.remove('dragover');
      if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    });

    input.addEventListener('change', function () {
      if (input.files.length) uploadFiles(input.files);
      input.value = '';
    });
  }

  async function uploadFiles(files) {
    var productName = state.brief.product_name || 'unnamed';
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var fd = new FormData();
      fd.append('file', file);
      addFileRow(file.name, 'uploading...');
      try {
        await api('POST', '/api/upload/' + encodeURIComponent(productName), fd);
        updateFileRow(file.name, 'uploaded');
        state.brief.docs.push(file.name);
      } catch (e) {
        updateFileRow(file.name, 'error');
      }
    }
  }

  function addFileRow(name, status) {
    var container = $('#uploaded-files');
    if (!container) return;
    var row = createElement('div', { className: 'uploaded-file', 'data-file': name }, [
      createElement('span', { className: 'file-name', textContent: name }),
      createElement('span', { className: 'file-status', textContent: status }),
    ]);
    container.appendChild(row);
  }

  function updateFileRow(name, status) {
    var row = $('[data-file="' + CSS.escape(name) + '"]');
    if (row) {
      var s = row.querySelector('.file-status');
      if (s) s.textContent = status;
    }
  }

  // ---- Voice Input ----

  function setupVoice() {
    var btn = $('#voice-btn');
    if (!btn) return;
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      btn.style.display = 'none';
      return;
    }
    var recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    var recording = false;

    btn.addEventListener('click', function () {
      if (recording) {
        recognition.stop();
        return;
      }
      recording = true;
      btn.classList.add('recording');
      recognition.start();
    });

    recognition.addEventListener('result', function (e) {
      var transcript = e.results[0][0].transcript;
      var desc = $('#description');
      if (desc) desc.value = (desc.value ? desc.value + ' ' : '') + transcript;
    });

    recognition.addEventListener('end', function () {
      recording = false;
      btn.classList.remove('recording');
    });

    recognition.addEventListener('error', function () {
      recording = false;
      btn.classList.remove('recording');
    });
  }

  // ---- Step 4: Review ----

  function renderStep4() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card' });
    card.appendChild(createElement('h2', { textContent: 'Review Your Data Product' }));

    // Product section
    var prodSection = createElement('div', { className: 'review-section' });
    var prodHeader = createElement('div', { className: 'review-header' });
    prodHeader.appendChild(createElement('h3', { textContent: 'Product' }));
    var prodEdit = createElement('span', { className: 'review-edit-link', textContent: 'Edit' });
    prodEdit.addEventListener('click', function () { goToStep(1); });
    prodHeader.appendChild(prodEdit);
    prodSection.appendChild(prodHeader);
    var prodBody = createElement('div', { className: 'review-body' });
    prodBody.appendChild(createReviewRow('Product Name', state.brief.product_name || '(not set)'));
    prodBody.appendChild(createReviewRow('Description', state.brief.description || '(none)'));
    prodSection.appendChild(prodBody);
    card.appendChild(prodSection);

    // Owner section
    var ownerSection = createElement('div', { className: 'review-section' });
    var ownerHeader = createElement('div', { className: 'review-header' });
    ownerHeader.appendChild(createElement('h3', { textContent: 'Owner' }));
    var ownerEdit = createElement('span', { className: 'review-edit-link', textContent: 'Edit' });
    ownerEdit.addEventListener('click', function () { goToStep(2); });
    ownerHeader.appendChild(ownerEdit);
    ownerSection.appendChild(ownerHeader);
    var ownerBody = createElement('div', { className: 'review-body' });
    ownerBody.appendChild(createReviewRow('Owner', state.brief.owner.name || '(not set)'));
    ownerBody.appendChild(createReviewRow('Team', state.brief.owner.team || '(not set)'));
    ownerBody.appendChild(createReviewRow('Email', state.brief.owner.email || '(not set)'));
    ownerSection.appendChild(ownerBody);
    card.appendChild(ownerSection);

    // Context section
    var ctxSection = createElement('div', { className: 'review-section' });
    var ctxHeader = createElement('div', { className: 'review-header' });
    ctxHeader.appendChild(createElement('h3', { textContent: 'Context' }));
    var ctxEdit = createElement('span', { className: 'review-edit-link', textContent: 'Edit' });
    ctxEdit.addEventListener('click', function () { goToStep(3); });
    ctxHeader.appendChild(ctxEdit);
    ctxSection.appendChild(ctxHeader);
    var ctxBody = createElement('div', { className: 'review-body' });
    ctxBody.appendChild(createReviewRow('Sensitivity', state.brief.sensitivity));
    ctxBody.appendChild(createReviewRow('Data Source', state.brief.data_source || '(none selected) \u2014 ' + state.sources.length + ' detected'));
    ctxBody.appendChild(createReviewRow('Uploaded Docs', state.brief.docs.length > 0 ? state.brief.docs.join(', ') : '(none)'));
    ctxSection.appendChild(ctxBody);
    card.appendChild(ctxSection);

    card.appendChild(createStepActions(true, true, 'Build'));
    content.appendChild(card);
  }

  function createReviewRow(label, value) {
    return createElement('div', { className: 'review-row' }, [
      createElement('span', { className: 'review-label', textContent: label }),
      createElement('span', { className: 'review-value', textContent: value }),
    ]);
  }

  // ---- Step 5: Build ----

  var STAGES = [
    'Saving context brief',
    'Scanning data sources',
    'Extracting schema metadata',
    'Generating semantic descriptions',
    'Writing OSI-ready context',
  ];

  function renderStep5() {
    var content = document.getElementById('wizard-content');
    if (!content) return;

    var card = createElement('div', { className: 'card' });
    card.appendChild(createElement('h2', { textContent: 'Building Your Data Product' }));

    var timeline = createElement('div', { className: 'pipeline-timeline', id: 'pipeline-timeline' });
    card.appendChild(timeline);

    var doneEl = createElement('div', { className: 'pipeline-done', id: 'pipeline-done' }, [
      createElement('p', { textContent: 'Your data product has been built successfully.' }),
      createElement('p', { className: 'muted', textContent: 'You can now use it with any MCP-compatible tool.' }),
    ]);
    doneEl.style.display = 'none';
    card.appendChild(doneEl);

    content.appendChild(card);

    startBuild();
  }

  function buildStageElement(item) {
    var statusClass = 'stage-pending';
    var dotText = '';
    if (item.status === 'done' || item.status === 'completed' || item.status === 'complete') {
      statusClass = 'stage-done';
      dotText = '\u2713';
    } else if (item.status === 'running' || item.status === 'in_progress') {
      statusClass = 'stage-running';
      dotText = '\u2026';
    } else if (item.status === 'error') {
      statusClass = 'stage-error';
      dotText = '!';
    }

    var header = createElement('div', { className: 'pipeline-stage-header' }, [
      createElement('div', { className: 'stage-dot', textContent: dotText }),
      createElement('span', { className: 'stage-name', textContent: item.stage }),
      item.detail ? createElement('span', { className: 'stage-summary', textContent: item.detail }) : null,
    ]);

    var bodyInner = createElement('div', { className: 'pipeline-stage-body-inner' });
    if (item.detail) {
      bodyInner.appendChild(createElement('p', { className: 'muted', textContent: item.detail }));
    }

    var body = createElement('div', { className: 'pipeline-stage-body' }, [bodyInner]);

    var stage = createElement('div', { className: 'pipeline-stage ' + statusClass }, [header, body]);

    header.addEventListener('click', function () {
      stage.classList.toggle('expanded');
    });

    return stage;
  }

  function renderTimeline(items) {
    var el = $('#pipeline-timeline');
    if (!el) return;
    if (items.length === 0) {
      items = STAGES.map(function (name) {
        return { stage: name, status: 'pending', detail: '' };
      });
    }
    el.textContent = '';
    items.forEach(function (item) {
      el.appendChild(buildStageElement(item));
    });
  }

  function renderTimelineFromStatus(data) {
    var stages = data.stages || data.steps || [];
    var items = stages.map(function (s) {
      return {
        stage: s.name || s.stage || s.label || '',
        status: s.status || 'pending',
        detail: s.detail || s.message || '',
      };
    });
    if (items.length === 0 && typeof data.currentStep === 'number') {
      items = STAGES.map(function (name, i) {
        var status = 'pending';
        if (i < data.currentStep) status = 'done';
        else if (i === data.currentStep) status = 'running';
        return { stage: name, status: status, detail: '' };
      });
    }
    renderTimeline(items);
  }

  async function startBuild() {
    renderTimeline([]);
    try {
      await api('POST', '/api/brief', state.brief);
      var result = await api('POST', '/api/pipeline/start', {
        productName: state.brief.product_name,
        targetTier: 'gold',
      });
      state.pipelineId = result.id || result.pipelineId;
      saveState();
      pollPipeline();
    } catch (e) {
      renderTimeline([{ stage: 'Error', status: 'error', detail: e.message }]);
    }
  }

  function pollPipeline() {
    if (!state.pipelineId) return;
    state.pollTimer = setInterval(async function () {
      try {
        var data = await api('GET', '/api/pipeline/status/' + encodeURIComponent(state.pipelineId));
        renderTimelineFromStatus(data);
        if (data.status === 'done' || data.status === 'complete' || data.status === 'completed' || data.status === 'error') {
          clearInterval(state.pollTimer);
          if (data.status !== 'error') {
            var doneEl = $('#pipeline-done');
            if (doneEl) doneEl.style.display = '';
          }
        }
      } catch (e) {
        clearInterval(state.pollTimer);
        renderTimeline([{ stage: 'Error', status: 'error', detail: e.message }]);
      }
    }, 1000);
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
