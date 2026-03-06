import { HEAD, NAV, FOOTER, TIER_BADGE, SCRIPTS } from './shared.js';

export const modelTemplate = `${HEAD}
<body>
${NAV}
${TIER_BADGE}

<main class="page">
  <a href="<%= basePath %>/" class="back-link">&larr; All Models</a>

  <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
    <h1 style="font-family:var(--serif);font-weight:300;font-size:clamp(2rem,5vw,3.5rem);color:var(--text);"><%= model.name %></h1>
    <% if (tier) { %><%- tierBadge(tier.tier) %><% } %>
  </div>
  <% if (model.description) { %>
    <p style="color:var(--text-muted);font-size:1rem;margin-bottom:1.5rem;max-width:700px;font-weight:300;"><%= model.description %></p>
  <% } %>

  <div style="display:flex;gap:0.6rem;margin-bottom:2.5rem;">
    <a href="<%= basePath %>/models/<%= model.name %>/schema.html" class="tag tag-nav tag-blue">Schema Browser</a>
    <a href="<%= basePath %>/models/<%= model.name %>/rules.html" class="tag tag-nav tag-gold">Rules &amp; Queries</a>
  </div>

  <% if (gov) { %>
  <div class="section reveal">
    <div class="section-label">Governance</div>
    <div class="gov-grid">
      <div class="gov-item">
        <div class="gov-label">Owner</div>
        <div class="gov-value"><a href="<%= basePath %>/owners/<%= gov.owner %>.html"><%= gov.owner %></a></div>
      </div>
      <% if (gov.trust) { %>
      <div class="gov-item">
        <div class="gov-label">Trust</div>
        <div class="gov-value"><%= gov.trust %></div>
      </div>
      <% } %>
      <% if (gov.security) { %>
      <div class="gov-item">
        <div class="gov-label">Security</div>
        <div class="gov-value"><%= gov.security %></div>
      </div>
      <% } %>
      <% if (gov.tags && gov.tags.length > 0) { %>
      <div class="gov-item">
        <div class="gov-label">Tags</div>
        <div class="gov-value" style="display:flex;gap:0.4rem;flex-wrap:wrap;">
          <% for (var t of gov.tags) { %><span class="tag"><%= t %></span><% } %>
        </div>
      </div>
      <% } %>
    </div>
  </div>
  <% } %>

  <% if (model.datasets && model.datasets.length > 0) { %>
  <div class="section reveal">
    <div class="section-label">Data Explorer</div>
    <h2 class="section-title">Datasets</h2>
    <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem;font-weight:300;">Click a dataset to explore its fields, governance, and metadata.</p>
    <div style="display:flex;flex-direction:column;gap:1rem;">
      <% for (var i = 0; i < model.datasets.length; i++) { var ds = model.datasets[i]; %>
        <% var dsGov = gov && gov.datasets && gov.datasets[ds.name]; %>
        <div class="card">
          <div class="expandable-header" onclick="toggleExpand('ds-<%= i %>')">
            <div>
              <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.25rem;">
                <span class="mono" style="color:var(--text);"><%= ds.name %></span>
                <% if (dsGov && dsGov.table_type) { %>
                  <span class="ds-type ds-type-<%= dsGov.table_type %>"><%= dsGov.table_type %></span>
                <% } %>
                <% if (ds.fields) { %><span class="tag"><%= ds.fields.length %> fields</span><% } %>
              </div>
              <div style="font-size:0.75rem;color:var(--text-dim);font-family:var(--mono);">
                <%= ds.source %>
                <% if (dsGov && dsGov.grain) { %> &middot; <span style="color:var(--text-muted);font-family:var(--sans);"><%= dsGov.grain %></span><% } %>
                <% if (dsGov && dsGov.refresh) { %> &middot; <span style="color:var(--text-muted);font-family:var(--sans);"><%= dsGov.refresh %></span><% } %>
              </div>
              <% if (ds.description) { %>
                <p style="font-size:0.82rem;color:var(--text-muted);margin-top:0.4rem;font-weight:300;"><%= ds.description %></p>
              <% } %>
            </div>
            <span class="expand-icon" id="ds-<%= i %>-icon">+</span>
          </div>
          <div class="expandable-content" id="ds-<%= i %>">
            <% if (ds.fields && ds.fields.length > 0) { %>
            <table class="table-dark" style="margin-top:1rem;">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Description</th>
                  <th>Role</th>
                  <th>Aggregation</th>
                </tr>
              </thead>
              <tbody>
                <% for (var field of ds.fields) { %>
                  <% var fKey = ds.name + '.' + field.name; %>
                  <% var fGov = gov && gov.fields && gov.fields[fKey]; %>
                  <% var role = fGov && fGov.semantic_role ? fGov.semantic_role : ''; %>
                  <tr>
                    <td class="mono" style="font-size:0.78rem;"><%= field.name %></td>
                    <td style="color:var(--text-muted);font-size:0.82rem;"><%= field.description || '' %></td>
                    <td><% if (role) { %><span class="tag role-<%= role %>"><%= role %></span><% } %></td>
                    <td style="font-family:var(--mono);font-size:0.78rem;color:var(--text-dim);"><%= fGov && fGov.default_aggregation ? fGov.default_aggregation : '' %></td>
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
  <div class="section reveal">
    <div class="section-label">Data Model</div>
    <h2 class="section-title">Relationships</h2>
    <table class="table-dark">
      <thead>
        <tr><th>Name</th><th>From</th><th></th><th>To</th></tr>
      </thead>
      <tbody>
        <% for (var rel of model.relationships) { %>
          <tr>
            <td style="color:var(--text-muted);font-size:0.82rem;"><%= rel.name %></td>
            <td class="mono" style="font-size:0.78rem;"><%= rel.from %></td>
            <td style="color:var(--gold-dark);text-align:center;">&rarr;</td>
            <td class="mono" style="font-size:0.78rem;"><%= rel.to %></td>
          </tr>
        <% } %>
      </tbody>
    </table>
  </div>
  <% } %>

  <% if (model.metrics && model.metrics.length > 0) { %>
  <div class="section reveal">
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

  <% if (lineage && (lineage.upstream && lineage.upstream.length > 0 || lineage.downstream && lineage.downstream.length > 0)) { %>
  <div class="section reveal">
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
        <div class="lineage-node" style="border-color:var(--gold-dark);">
          <div class="lineage-node-name" style="color:var(--gold);"><%= model.name %></div>
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

  <% if (tier) { %>
  <div class="section reveal">
    <div class="section-label">Data Quality</div>
    <h2 class="section-title">Tier Scorecard</h2>
    <div class="scorecard">
      <% var tierLevels = ['bronze', 'silver', 'gold']; %>
      <% for (var lvl of tierLevels) { %>
        <div class="scorecard-tier">
          <div class="scorecard-tier-header">
            <span class="scorecard-tier-name <%= lvl %>"><%= lvl %></span>
            <% if (tier[lvl].passed) { %>
              <span class="scorecard-pass passed">Passed</span>
            <% } else { %>
              <span class="scorecard-pass failed">Not passed</span>
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
</main>

${FOOTER}
${SCRIPTS}
</body>
</html>`;
