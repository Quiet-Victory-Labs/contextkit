import { HEAD, TOPBAR, SIDEBAR, SIDEBAR_DATA, FOOTER, TIER_BADGE, SCRIPTS } from './shared.js';

export const modelTemplate = `${HEAD}
<body>
${TOPBAR}
${SIDEBAR_DATA}
${SIDEBAR}
${TIER_BADGE}

<div class="main">
  <div class="breadcrumb">
    <a href="<%= basePath %>/index.html">Home</a>
    <span class="breadcrumb-sep">/</span>
    <span><%= model.name %></span>
  </div>

  <div class="page-header">
    <div style="display:flex;align-items:center;gap:0.6rem;">
      <h1><%= model.name %></h1>
      <% if (tier) { %><%- tierBadge(tier.tier) %><% } %>
    </div>
    <% if (typeof studioMode !== 'undefined' && studioMode) { %>
      <p class="subtitle"><span class="editable" data-file="context/models/<%= model.name %>.osi.yaml" data-path="semantic_model.0.description" data-label="Model description"><%= model.description || 'Add description...' %></span></p>
    <% } else { %>
      <% if (model.description) { %>
        <p class="subtitle"><%= model.description %></p>
      <% } %>
    <% } %>
  </div>

  <% if (typeof studioMode !== 'undefined' && studioMode) { %>
  <div class="section">
    <div class="section-label">AI Context</div>
    <div class="card" style="margin-bottom:1rem;">
      <span class="editable" data-file="context/models/<%= model.name %>.osi.yaml" data-path="semantic_model.0.ai_context" data-label="AI context"><%= (typeof model.ai_context === 'string' ? model.ai_context : (model.ai_context ? JSON.stringify(model.ai_context) : 'Add AI context...')) %></span>
    </div>
  </div>
  <% } else { %>
    <% if (model.ai_context) { %>
    <div class="section">
      <div class="section-label">AI Context</div>
      <div class="card" style="margin-bottom:1rem;">
        <p style="font-size:0.85rem;color:var(--text-secondary);font-weight:300;line-height:1.6;"><%= typeof model.ai_context === 'string' ? model.ai_context : JSON.stringify(model.ai_context) %></p>
      </div>
    </div>
    <% } %>
  <% } %>

  <div style="display:flex;gap:0.5rem;margin-bottom:2rem;">
    <a href="<%= basePath %>/models/<%= model.name %>/schema.html" class="tag tag-blue" style="padding:0.3rem 0.6rem;font-size:0.65rem;text-decoration:none;">Schema Browser</a>
    <a href="<%= basePath %>/models/<%= model.name %>/rules.html" class="tag tag-gold" style="padding:0.3rem 0.6rem;font-size:0.65rem;text-decoration:none;">Rules &amp; Queries</a>
  </div>

  <% if (gov) { %>
  <div class="section">
    <div class="section-label">Governance</div>
    <div class="gov-grid">
      <div class="gov-cell">
        <div class="gov-label">Owner</div>
        <div class="gov-value"><a href="<%= basePath %>/owners/<%= gov.owner %>.html"><%= gov.owner %></a></div>
      </div>
      <div class="gov-cell">
        <div class="gov-label">Trust</div>
        <div class="gov-value">
          <% if (typeof studioMode !== 'undefined' && studioMode) { %>
            <span class="dropdown-editable" data-file="context/governance/<%= model.name %>.governance.yaml" data-path="trust" data-label="Trust" data-options="draft,reviewed,endorsed,certified"><%= gov.trust || 'Select...' %></span>
          <% } else { %>
            <%= gov.trust || '' %>
          <% } %>
        </div>
      </div>
      <% if (gov.security) { %>
      <div class="gov-cell">
        <div class="gov-label">Security</div>
        <div class="gov-value"><%= gov.security %></div>
      </div>
      <% } %>
      <div class="gov-cell">
        <div class="gov-label">Refresh Cadence</div>
        <div class="gov-value">
          <% if (typeof studioMode !== 'undefined' && studioMode) { %>
            <span class="editable" data-file="context/governance/<%= model.name %>.governance.yaml" data-path="refresh" data-label="Refresh cadence"><%= gov.refresh || 'Add refresh cadence...' %></span>
          <% } else { %>
            <%= gov.refresh || '' %>
          <% } %>
        </div>
      </div>
      <% if (gov.tags && gov.tags.length > 0) { %>
      <div class="gov-cell">
        <div class="gov-label">Tags</div>
        <div class="gov-value" style="display:flex;gap:0.3rem;flex-wrap:wrap;">
          <% for (var t of gov.tags) { %><span class="tag"><%= t %></span><% } %>
        </div>
      </div>
      <% } %>
    </div>
  </div>
  <% } %>

  <% if (model.datasets && model.datasets.length > 0) { %>
  <div class="section">
    <div class="section-label">Data Explorer</div>
    <h2 class="section-title">Datasets</h2>
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      <% for (var i = 0; i < model.datasets.length; i++) { var ds = model.datasets[i]; %>
        <% var dsGov = gov && gov.datasets && gov.datasets[ds.name]; %>
        <div class="card">
          <div class="expandable-header" onclick="toggleExpand('ds-<%= i %>')">
            <div>
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.15rem;">
                <span class="mono" style="font-size:0.85rem;color:var(--text);"><%= ds.name %></span>
                <% if (dsGov && dsGov.table_type) { %>
                  <span class="tag ds-<%= dsGov.table_type %>"><%= dsGov.table_type %></span>
                <% } %>
                <% if (ds.fields) { %><span class="tag"><%= ds.fields.length %> fields</span><% } %>
              </div>
              <div style="font-size:0.72rem;color:var(--text-dim);font-family:var(--mono);">
                <%= ds.source %>
                <% if (dsGov && dsGov.grain) { %> &middot; <span style="font-family:var(--sans);color:var(--text-secondary);"><%= dsGov.grain %></span><% } %>
              </div>
              <% if (ds.description) { %>
                <p style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.3rem;font-weight:300;"><%= ds.description %></p>
              <% } %>
            </div>
            <span class="expand-icon" id="ds-<%= i %>-icon">+</span>
          </div>
          <div class="expandable-content" id="ds-<%= i %>">
            <% if (ds.fields && ds.fields.length > 0) { %>
            <table class="data-table" style="margin-top:0.75rem;">
              <thead>
                <tr><th>Field</th><th>Description</th><th>Role</th><th>Aggregation</th></tr>
              </thead>
              <tbody>
                <% for (var field of ds.fields) { %>
                  <% var fKey = ds.name + '.' + field.name; %>
                  <% var fGov = gov && gov.fields && gov.fields[fKey]; %>
                  <% var role = fGov && fGov.semantic_role ? fGov.semantic_role : ''; %>
                  <tr>
                    <td class="mono" style="font-size:0.75rem;"><%= field.name %></td>
                    <td style="color:var(--text-secondary);font-size:0.8rem;"><%= field.description || '' %></td>
                    <td><% if (role) { %><span class="tag role-<%= role %>"><%= role %></span><% } %></td>
                    <td class="mono" style="font-size:0.75rem;color:var(--text-dim);"><%= fGov && fGov.default_aggregation ? fGov.default_aggregation : '' %></td>
                  </tr>
                <% } %>
              </tbody>
            </table>
            <% } %>
          </div>
        </div>
      <% } %>
    </div>
  </div>
  <% } %>

  <% if (model.relationships && model.relationships.length > 0) { %>
  <div class="section">
    <div class="section-label">Data Model</div>
    <h2 class="section-title">Relationships</h2>
    <table class="data-table">
      <thead>
        <tr><th>Name</th><th>From</th><th></th><th>To</th></tr>
      </thead>
      <tbody>
        <% for (var rel of model.relationships) { %>
          <tr>
            <td style="color:var(--text-secondary);font-size:0.8rem;"><%= rel.name %></td>
            <td class="mono" style="font-size:0.75rem;"><%= rel.from %></td>
            <td style="color:var(--text-dim);text-align:center;">&rarr;</td>
            <td class="mono" style="font-size:0.75rem;"><%= rel.to %></td>
          </tr>
        <% } %>
      </tbody>
    </table>
  </div>
  <% } %>

  <% if (model.metrics && model.metrics.length > 0) { %>
  <div class="section">
    <div class="section-label">Computed Metrics</div>
    <h2 class="section-title">Metrics</h2>
    <div class="card-grid">
      <% for (var metric of model.metrics) { %>
        <div class="card">
          <div class="metric-name"><%= metric.name %></div>
          <% if (metric.description) { %><div class="metric-desc"><%= metric.description %></div><% } %>
          <% if (metric.expression && metric.expression.dialects && metric.expression.dialects.length > 0) { %>
            <div class="metric-formula"><%= metric.expression.dialects[0].expression %></div>
          <% } %>
        </div>
      <% } %>
    </div>
  </div>
  <% } %>

  <% if (rules && rules.golden_queries && rules.golden_queries.length > 0) { %>
  <div class="section">
    <div class="section-label">Golden Queries</div>
    <h2 class="section-title">Pre-validated Queries</h2>
    <% for (var gq of rules.golden_queries) { %>
      <div class="query-card">
        <div class="query-q">
          <span class="query-q-badge">Q</span>
          <span><%= gq.question %></span>
        </div>
        <div class="query-sql sql-highlight"><%= gq.sql %></div>
        <% if (gq.description) { %>
        <div class="query-meta"><span><%= gq.description %></span></div>
        <% } %>
      </div>
    <% } %>
  </div>
  <% } %>
  <% if (typeof studioMode !== 'undefined' && studioMode) { %>
  <div class="section" id="golden-queries-studio">
    <% if (!(rules && rules.golden_queries && rules.golden_queries.length > 0)) { %>
    <div class="section-label">Golden Queries</div>
    <h2 class="section-title">Pre-validated Queries</h2>
    <% } %>
    <div id="golden-query-forms"></div>
    <button class="studio-add-btn" onclick="addGoldenQuery('<%= model.name %>')">+ Add Golden Query</button>
  </div>
  <script>
  function addGoldenQuery(modelName) {
    var container = document.getElementById('golden-query-forms');
    var card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '1rem';

    var questionLabel = document.createElement('label');
    questionLabel.style.cssText = 'display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;font-family:var(--mono);';
    questionLabel.textContent = 'Question';
    var questionInput = document.createElement('input');
    questionInput.type = 'text';
    questionInput.className = 'search-input gq-question';
    questionInput.placeholder = 'e.g. What is the total revenue by region?';
    questionInput.style.fontSize = '0.85rem';
    var questionDiv = document.createElement('div');
    questionDiv.style.marginBottom = '0.75rem';
    questionDiv.appendChild(questionLabel);
    questionDiv.appendChild(questionInput);

    var sqlLabel = document.createElement('label');
    sqlLabel.style.cssText = 'display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;font-family:var(--mono);';
    sqlLabel.textContent = 'SQL';
    var sqlInput = document.createElement('textarea');
    sqlInput.className = 'search-input gq-sql';
    sqlInput.rows = 4;
    sqlInput.placeholder = 'SELECT ...';
    sqlInput.style.cssText = 'font-family:var(--mono);font-size:0.8rem;resize:vertical;';
    var sqlDiv = document.createElement('div');
    sqlDiv.style.marginBottom = '0.75rem';
    sqlDiv.appendChild(sqlLabel);
    sqlDiv.appendChild(sqlInput);

    var descLabel = document.createElement('label');
    descLabel.style.cssText = 'display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;font-family:var(--mono);';
    descLabel.textContent = 'Description';
    var descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'search-input gq-desc';
    descInput.placeholder = 'Optional description';
    descInput.style.fontSize = '0.85rem';
    var descDiv = document.createElement('div');
    descDiv.style.marginBottom = '0.75rem';
    descDiv.appendChild(descLabel);
    descDiv.appendChild(descInput);

    var stageBtn = document.createElement('button');
    stageBtn.className = 'staged-btn primary';
    stageBtn.style.cssText = 'font-size:0.8rem;padding:6px 16px;';
    stageBtn.textContent = 'Stage';
    stageBtn.addEventListener('click', function() { stageGoldenQuery(stageBtn, modelName); });

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'staged-btn secondary';
    cancelBtn.style.cssText = 'font-size:0.8rem;padding:6px 16px;';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() { card.remove(); });

    var btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display:flex;gap:0.5rem;';
    btnDiv.appendChild(stageBtn);
    btnDiv.appendChild(cancelBtn);

    card.appendChild(questionDiv);
    card.appendChild(sqlDiv);
    card.appendChild(descDiv);
    card.appendChild(btnDiv);
    container.appendChild(card);
  }

  function stageGoldenQuery(btn, modelName) {
    var card = btn.closest('.card');
    var question = card.querySelector('.gq-question').value.trim();
    var sql = card.querySelector('.gq-sql').value.trim();
    var desc = card.querySelector('.gq-desc').value.trim();
    if (!question || !sql) { showToast('Question and SQL are required'); return; }
    var entry = { question: question, sql: sql };
    if (desc) entry.description = desc;
    stageEdit('context/rules/' + modelName + '.rules.yaml', 'golden_queries.+', entry, 'Add golden query: ' + question);
    card.style.borderColor = '#4ade80';
    btn.textContent = 'Staged';
    btn.disabled = true;
  }
  </script>
  <% } %>

  <% if (rules && rules.guardrail_filters && rules.guardrail_filters.length > 0) { %>
  <div class="section">
    <div class="section-label">Safety</div>
    <h2 class="section-title">Guardrail Filters</h2>
    <% for (var gf of rules.guardrail_filters) { %>
      <div class="guardrail">
        <div class="guardrail-name"><%= gf.name %></div>
        <div class="guardrail-filter"><%= gf.filter %></div>
        <div class="guardrail-reason"><%= gf.reason %></div>
      </div>
    <% } %>
  </div>
  <% } %>
  <% if (typeof studioMode !== 'undefined' && studioMode) { %>
  <div class="section" id="guardrails-studio">
    <% if (!(rules && rules.guardrail_filters && rules.guardrail_filters.length > 0)) { %>
    <div class="section-label">Safety</div>
    <h2 class="section-title">Guardrail Filters</h2>
    <% } %>
    <div id="guardrail-forms"></div>
    <button class="studio-add-btn" onclick="addGuardrail('<%= model.name %>')">+ Add Guardrail</button>
  </div>
  <script>
  function addGuardrail(modelName) {
    var container = document.getElementById('guardrail-forms');
    var card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '1rem';

    var nameLabel = document.createElement('label');
    nameLabel.style.cssText = 'display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;font-family:var(--mono);';
    nameLabel.textContent = 'Name';
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'search-input gr-name';
    nameInput.placeholder = 'e.g. pii_filter';
    nameInput.style.fontSize = '0.85rem';
    var nameDiv = document.createElement('div');
    nameDiv.style.marginBottom = '0.75rem';
    nameDiv.appendChild(nameLabel);
    nameDiv.appendChild(nameInput);

    var filterLabel = document.createElement('label');
    filterLabel.style.cssText = 'display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;font-family:var(--mono);';
    filterLabel.textContent = 'Filter Expression';
    var filterInput = document.createElement('input');
    filterInput.type = 'text';
    filterInput.className = 'search-input gr-filter';
    filterInput.placeholder = 'e.g. WHERE email IS NOT NULL';
    filterInput.style.cssText = 'font-family:var(--mono);font-size:0.85rem;';
    var filterDiv = document.createElement('div');
    filterDiv.style.marginBottom = '0.75rem';
    filterDiv.appendChild(filterLabel);
    filterDiv.appendChild(filterInput);

    var reasonLabel = document.createElement('label');
    reasonLabel.style.cssText = 'display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;font-family:var(--mono);';
    reasonLabel.textContent = 'Reason';
    var reasonInput = document.createElement('input');
    reasonInput.type = 'text';
    reasonInput.className = 'search-input gr-reason';
    reasonInput.placeholder = 'Why this guardrail exists';
    reasonInput.style.fontSize = '0.85rem';
    var reasonDiv = document.createElement('div');
    reasonDiv.style.marginBottom = '0.75rem';
    reasonDiv.appendChild(reasonLabel);
    reasonDiv.appendChild(reasonInput);

    var stageBtn = document.createElement('button');
    stageBtn.className = 'staged-btn primary';
    stageBtn.style.cssText = 'font-size:0.8rem;padding:6px 16px;';
    stageBtn.textContent = 'Stage';
    stageBtn.addEventListener('click', function() { stageGuardrail(stageBtn, modelName); });

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'staged-btn secondary';
    cancelBtn.style.cssText = 'font-size:0.8rem;padding:6px 16px;';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() { card.remove(); });

    var btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display:flex;gap:0.5rem;';
    btnDiv.appendChild(stageBtn);
    btnDiv.appendChild(cancelBtn);

    card.appendChild(nameDiv);
    card.appendChild(filterDiv);
    card.appendChild(reasonDiv);
    card.appendChild(btnDiv);
    container.appendChild(card);
  }

  function stageGuardrail(btn, modelName) {
    var card = btn.closest('.card');
    var name = card.querySelector('.gr-name').value.trim();
    var filter = card.querySelector('.gr-filter').value.trim();
    var reason = card.querySelector('.gr-reason').value.trim();
    if (!name || !filter) { showToast('Name and filter expression are required'); return; }
    var entry = { name: name, filter: filter };
    if (reason) entry.reason = reason;
    stageEdit('context/rules/' + modelName + '.rules.yaml', 'guardrail_filters.+', entry, 'Add guardrail: ' + name);
    card.style.borderColor = '#4ade80';
    btn.textContent = 'Staged';
    btn.disabled = true;
  }
  </script>
  <% } %>

  <% if (lineage && (lineage.upstream && lineage.upstream.length > 0 || lineage.downstream && lineage.downstream.length > 0)) { %>
  <div class="section">
    <div class="section-label">Data Lineage</div>
    <h2 class="section-title">Lineage</h2>
    <div class="lineage-flow">
      <% if (lineage.upstream && lineage.upstream.length > 0) { %>
      <div class="lineage-col">
        <div class="lineage-col-label">Upstream</div>
        <% for (var u of lineage.upstream) { %>
          <div class="lineage-node">
            <div class="lineage-node-name"><%= u.source %></div>
            <div class="lineage-node-detail"><%= u.type || '' %><% if (u.tool) { %> via <%= u.tool %><% } %></div>
          </div>
        <% } %>
      </div>
      <div class="lineage-arrow">&rarr;</div>
      <% } %>
      <div class="lineage-col">
        <div class="lineage-col-label">This Model</div>
        <div class="lineage-node" style="border-color:var(--accent-border);">
          <div class="lineage-node-name" style="color:var(--accent);"><%= model.name %></div>
        </div>
      </div>
      <% if (lineage.downstream && lineage.downstream.length > 0) { %>
      <div class="lineage-arrow">&rarr;</div>
      <div class="lineage-col">
        <div class="lineage-col-label">Downstream</div>
        <% for (var d of lineage.downstream) { %>
          <div class="lineage-node">
            <div class="lineage-node-name"><%= d.target %></div>
            <div class="lineage-node-detail"><%= d.type || '' %><% if (d.tool) { %> via <%= d.tool %><% } %></div>
          </div>
        <% } %>
      </div>
      <% } %>
    </div>
  </div>
  <% } %>
  <% if (typeof studioMode !== 'undefined' && studioMode) { %>
  <div class="section" id="lineage-studio">
    <% if (!(lineage && (lineage.upstream && lineage.upstream.length > 0 || lineage.downstream && lineage.downstream.length > 0))) { %>
    <div class="section-label">Data Lineage</div>
    <h2 class="section-title">Lineage</h2>
    <% } %>
    <div id="upstream-forms"></div>
    <button class="studio-add-btn" onclick="addUpstreamSource('<%= model.name %>')" style="margin-bottom:0.75rem;">+ Add Upstream Source</button>
    <div id="downstream-forms"></div>
    <button class="studio-add-btn" onclick="addDownstreamTarget('<%= model.name %>')">+ Add Downstream Target</button>
  </div>
  <script>
  function createLineageForm(container, direction, modelName) {
    var card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '1rem';

    var nameLabel = document.createElement('label');
    nameLabel.style.cssText = 'display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;font-family:var(--mono);';
    nameLabel.textContent = direction === 'upstream' ? 'Source Name' : 'Target Name';
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'search-input lin-name';
    nameInput.placeholder = direction === 'upstream' ? 'e.g. raw_orders_db' : 'e.g. revenue_dashboard';
    nameInput.style.fontSize = '0.85rem';
    var nameDiv = document.createElement('div');
    nameDiv.style.marginBottom = '0.75rem';
    nameDiv.appendChild(nameLabel);
    nameDiv.appendChild(nameInput);

    var typeLabel = document.createElement('label');
    typeLabel.style.cssText = 'display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;font-family:var(--mono);';
    typeLabel.textContent = 'Type';
    var typeSelect = document.createElement('select');
    typeSelect.className = 'search-input lin-type';
    typeSelect.style.fontSize = '0.85rem';
    ['pipeline', 'dashboard', 'api', 'file', 'derived'].forEach(function(opt) {
      var option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      typeSelect.appendChild(option);
    });
    var typeDiv = document.createElement('div');
    typeDiv.style.marginBottom = '0.75rem';
    typeDiv.appendChild(typeLabel);
    typeDiv.appendChild(typeSelect);

    var notesLabel = document.createElement('label');
    notesLabel.style.cssText = 'display:block;font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.25rem;font-family:var(--mono);';
    notesLabel.textContent = 'Notes';
    var notesInput = document.createElement('input');
    notesInput.type = 'text';
    notesInput.className = 'search-input lin-notes';
    notesInput.placeholder = 'Optional notes';
    notesInput.style.fontSize = '0.85rem';
    var notesDiv = document.createElement('div');
    notesDiv.style.marginBottom = '0.75rem';
    notesDiv.appendChild(notesLabel);
    notesDiv.appendChild(notesInput);

    var stageBtn = document.createElement('button');
    stageBtn.className = 'staged-btn primary';
    stageBtn.style.cssText = 'font-size:0.8rem;padding:6px 16px;';
    stageBtn.textContent = 'Stage';
    stageBtn.addEventListener('click', function() {
      var entryName = card.querySelector('.lin-name').value.trim();
      var entryType = card.querySelector('.lin-type').value;
      var entryNotes = card.querySelector('.lin-notes').value.trim();
      if (!entryName) { showToast((direction === 'upstream' ? 'Source' : 'Target') + ' name is required'); return; }
      var entry = {};
      if (direction === 'upstream') { entry.source = entryName; } else { entry.target = entryName; }
      entry.type = entryType;
      if (entryNotes) entry.notes = entryNotes;
      stageEdit('context/lineage/' + modelName + '.lineage.yaml', direction + '.+', entry, 'Add ' + direction + ': ' + entryName);
      card.style.borderColor = '#4ade80';
      stageBtn.textContent = 'Staged';
      stageBtn.disabled = true;
    });

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'staged-btn secondary';
    cancelBtn.style.cssText = 'font-size:0.8rem;padding:6px 16px;';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() { card.remove(); });

    var btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display:flex;gap:0.5rem;';
    btnDiv.appendChild(stageBtn);
    btnDiv.appendChild(cancelBtn);

    card.appendChild(nameDiv);
    card.appendChild(typeDiv);
    card.appendChild(notesDiv);
    card.appendChild(btnDiv);
    container.appendChild(card);
  }

  function addUpstreamSource(modelName) {
    createLineageForm(document.getElementById('upstream-forms'), 'upstream', modelName);
  }

  function addDownstreamTarget(modelName) {
    createLineageForm(document.getElementById('downstream-forms'), 'downstream', modelName);
  }
  </script>
  <% } %>

  <% if (tier) { %>
  <div class="section">
    <div class="section-label">Data Quality</div>
    <h2 class="section-title">Tier Scorecard</h2>
    <div class="scorecard">
      <% var tierLevels = ['bronze', 'silver', 'gold']; %>
      <% for (var lvl of tierLevels) { %>
        <div class="sc-tier">
          <div class="sc-tier-head">
            <span class="sc-tier-name <%= lvl %>"><%= lvl %></span>
            <% if (tier[lvl].passed) { %>
              <span class="sc-status pass">Passed</span>
            <% } else { %>
              <span class="sc-status fail">Not passed</span>
            <% } %>
          </div>
          <% if (tier[lvl].checks && tier[lvl].checks.length > 0) { %>
            <ul class="check-list">
              <% for (var chk of tier[lvl].checks) { %>
                <li class="check-item">
                  <span class="check-icon <%= chk.passed ? 'pass' : 'fail' %>"><%= chk.passed ? '\\u2713' : '\\u2717' %></span>
                  <span><%= chk.label %><% if (chk.detail) { %> &mdash; <span style="color:var(--text-dim);"><%= chk.detail %></span><% } %></span>
                </li>
              <% } %>
            </ul>
          <% } %>
        </div>
      <% } %>
    </div>
  </div>
  <% } %>
</div>

${FOOTER}
${SCRIPTS}
</body>
</html>`;
