(function () {
  'use strict';

  var state = {
    step: 1,
    brief: {
      product_name: '',
      description: '',
      owner: { name: '', team: '', email: '' },
      sensitivity: 'internal',
      docs: [],
    },
    sources: [],
    pipelineId: null,
    pollTimer: null,
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

  // ---- DOM builder helpers (avoid innerHTML for security) ----

  function createElement(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'className') el.className = attrs[key];
        else if (key === 'textContent') el.textContent = attrs[key];
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

  // ---- Navigation ----

  function goToStep(n) {
    if (n < 1 || n > 5) return;
    for (var i = 1; i < n; i++) {
      var ps = $('.progress-step[data-step="' + i + '"]');
      if (ps) { ps.classList.remove('active'); ps.classList.add('completed'); }
    }
    var active = $('.progress-step[data-step="' + n + '"]');
    if (active) { active.classList.remove('completed'); active.classList.add('active'); }
    for (var j = n + 1; j <= 5; j++) {
      var fut = $('.progress-step[data-step="' + j + '"]');
      if (fut) { fut.classList.remove('active', 'completed'); }
    }
    $$('.step').forEach(function (el) { el.classList.remove('active'); });
    var panel = $('#step-' + n);
    if (panel) panel.classList.add('active');

    state.step = n;

    if (n === 3) loadSources();
    if (n === 4) renderReview();
    if (n === 5) startBuild();
  }

  function validateStep(n) {
    clearErrors();
    if (n === 1) {
      var name = $('#product-name').value.trim();
      if (!name) { showError('product-name', 'Product name is required'); return false; }
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) { showError('product-name', 'Only letters, numbers, dashes, underscores'); return false; }
      state.brief.product_name = name;
      state.brief.description = $('#description').value.trim();
      return true;
    }
    if (n === 2) {
      state.brief.owner.name = $('#owner-name').value.trim();
      state.brief.owner.team = $('#owner-team').value.trim();
      state.brief.owner.email = $('#owner-email').value.trim();
      return true;
    }
    return true;
  }

  // ---- Step 3: Sources & Upload ----

  async function loadSources() {
    var container = $('#sources-list');
    container.textContent = '';
    container.appendChild(createElement('p', { className: 'muted', textContent: 'Detecting data sources...' }));
    try {
      var data = await api('GET', '/api/sources');
      state.sources = data.sources || data || [];
      container.textContent = '';
      if (state.sources.length === 0) {
        container.appendChild(createElement('p', { className: 'muted', textContent: 'No data sources detected in this directory.' }));
        return;
      }
      state.sources.forEach(function (src) {
        var card = createElement('div', { className: 'source-card' }, [
          createElement('span', { className: 'source-name', textContent: src.name || src.type }),
          createElement('span', { className: 'source-type', textContent: src.type || '' }),
          createElement('span', { className: 'source-status detected', textContent: 'Detected' }),
        ]);
        container.appendChild(card);
      });
    } catch (e) {
      container.textContent = '';
      container.appendChild(createElement('p', { className: 'muted', textContent: 'Could not detect sources.' }));
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

  // ---- Sensitivity Cards ----

  function setupSensitivity() {
    $$('.sensitivity-cards .card').forEach(function (card) {
      card.addEventListener('click', function () {
        $$('.sensitivity-cards .card').forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
        state.brief.sensitivity = card.getAttribute('data-sensitivity');
      });
    });
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

  function renderReview() {
    var c = $('#review-content');
    if (!c) return;
    c.textContent = '';
    var rows = [
      ['Product Name', state.brief.product_name],
      ['Description', state.brief.description || '(none)'],
      ['Owner', state.brief.owner.name || '(not set)'],
      ['Team', state.brief.owner.team || '(not set)'],
      ['Email', state.brief.owner.email || '(not set)'],
      ['Sensitivity', state.brief.sensitivity],
      ['Data Sources', state.sources.length + ' detected'],
      ['Uploaded Docs', state.brief.docs.length > 0 ? state.brief.docs.join(', ') : '(none)'],
    ];
    rows.forEach(function (r) {
      var row = createElement('div', { className: 'review-row' }, [
        createElement('span', { className: 'review-label', textContent: r[0] }),
        createElement('span', { className: 'review-value', textContent: r[1] }),
      ]);
      c.appendChild(row);
    });
  }

  // ---- Step 5: Build ----

  var STAGES = [
    'Saving context brief',
    'Scanning data sources',
    'Extracting schema metadata',
    'Generating semantic descriptions',
    'Writing OSI-ready context',
  ];

  function buildStageElement(item) {
    var cls = 'pipeline-stage';
    var dotText = '';
    if (item.status === 'done' || item.status === 'completed' || item.status === 'complete') {
      cls += ' done';
      dotText = '\u2713';
    } else if (item.status === 'running' || item.status === 'in_progress') {
      cls += ' running';
      dotText = '\u2026';
    } else if (item.status === 'error') {
      cls += ' error';
      dotText = '!';
    }
    var children = [
      createElement('div', { className: 'stage-dot', textContent: dotText }),
      createElement('div', { className: 'stage-info' }, [
        createElement('div', { className: 'stage-name', textContent: item.stage }),
        item.detail ? createElement('div', { className: 'stage-status', textContent: item.detail }) : null,
      ]),
    ];
    return createElement('div', { className: cls }, children);
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
        product_name: state.brief.product_name,
      });
      state.pipelineId = result.id || result.pipelineId;
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
        var banner = document.createElement('div');
        banner.className = 'existing-products-banner';

        var title = document.createElement('p');
        title.className = 'banner-title';
        title.textContent = 'Your semantic plane has ' + products.length + ' data product' + (products.length === 1 ? '' : 's') + '. Adding another.';
        banner.appendChild(title);

        var list = document.createElement('div');
        list.className = 'product-chips';
        for (var i = 0; i < products.length; i++) {
          var chip = document.createElement('span');
          chip.className = 'product-chip';
          chip.textContent = products[i].name;
          list.appendChild(chip);
        }
        banner.appendChild(list);

        var step1 = document.getElementById('step-1');
        if (step1) {
          step1.parentNode.insertBefore(banner, step1);
        }
      }
    } catch (e) {
      // ignore - not critical
    }
  }

  // ---- Init ----

  function init() {
    $$('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (validateStep(state.step)) goToStep(state.step + 1);
      });
    });
    $$('[data-prev]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        goToStep(state.step - 1);
      });
    });

    setupSensitivity();
    setupUpload();
    setupVoice();
    checkExistingProducts();
    goToStep(1);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
