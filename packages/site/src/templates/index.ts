import { HEAD, TOPBAR, SIDEBAR, SIDEBAR_DATA, FOOTER, TIER_BADGE, SCRIPTS } from './shared.js';

export const indexTemplate = `${HEAD}
<body>
${TOPBAR}
${SIDEBAR_DATA}
${SIDEBAR}
${TIER_BADGE}

<div class="main">
  <div class="page-header">
    <h1>Metadata Catalog</h1>
    <p class="subtitle">Explore semantic models, governed datasets, business glossary, and data quality tiers.</p>
  </div>

  <%
    var modelNames = Object.keys(models);
    var totalDatasets = 0;
    var totalFields = 0;
    for (var mn of modelNames) {
      var m = models[mn];
      if (m.datasets) {
        totalDatasets += m.datasets.length;
        for (var ds of m.datasets) {
          if (ds.fields) totalFields += ds.fields.length;
        }
      }
    }
    var totalTerms = Object.keys(terms).length;
    var totalOwners = Object.keys(owners).length;
  %>

  <div class="stats-row">
    <div class="stat-item">
      <div class="stat-val"><%= modelNames.length %></div>
      <div class="stat-lbl">Models</div>
    </div>
    <div class="stat-item">
      <div class="stat-val"><%= totalDatasets %></div>
      <div class="stat-lbl">Datasets</div>
    </div>
    <div class="stat-item">
      <div class="stat-val"><%= totalFields %></div>
      <div class="stat-lbl">Fields</div>
    </div>
    <div class="stat-item">
      <div class="stat-val"><%= totalTerms %></div>
      <div class="stat-lbl">Terms</div>
    </div>
    <div class="stat-item">
      <div class="stat-val"><%= totalOwners %></div>
      <div class="stat-lbl">Owners</div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Semantic Models</div>
    <h2 class="section-title">Models</h2>
    <% if (modelNames.length === 0) { %>
      <p style="color:var(--text-secondary);">No models found. Run <code style="font-family:var(--mono);background:var(--bg-card);padding:0.15rem 0.4rem;border-radius:3px;">context introspect</code> to get started.</p>
    <% } else { %>
      <div class="card-grid">
        <% for (var name of modelNames) { %>
          <a href="<%= basePath %>/models/<%= name %>.html" class="card-link">
            <div class="card">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
                <span class="mono" style="font-size:0.88rem;color:var(--accent-light);"><%= name %></span>
                <% if (tiers[name]) { %><%- tierBadge(tiers[name].tier) %><% } %>
              </div>
              <% if (models[name].description) { %>
                <p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:0.5rem;font-weight:300;"><%= models[name].description %></p>
              <% } %>
              <% if (governance[name]) { %>
                <div style="display:flex;gap:0.35rem;flex-wrap:wrap;align-items:center;">
                  <% if (governance[name].owner) { %>
                    <span class="tag"><%= governance[name].owner %></span>
                  <% } %>
                  <% if (governance[name].trust) { %>
                    <span class="tag tag-green"><%= governance[name].trust %></span>
                  <% } %>
                  <% if (governance[name].tags) { for (var t of governance[name].tags) { %>
                    <span class="tag"><%= t %></span>
                  <% } } %>
                </div>
              <% } %>
            </div>
          </a>
        <% } %>
      </div>
    <% } %>
  </div>

  <% if (Object.keys(owners).length > 0) { %>
  <div class="section">
    <div class="section-label">Data Stewardship</div>
    <h2 class="section-title">Owners</h2>
    <div class="card-grid">
      <% for (var oid of Object.keys(owners)) { %>
        <a href="<%= basePath %>/owners/<%= oid %>.html" class="card-link">
          <div class="card">
            <div style="font-size:0.9rem;font-weight:500;color:var(--text);margin-bottom:0.15rem;"><%= owners[oid].display_name %></div>
            <% if (owners[oid].team) { %>
              <div style="font-size:0.75rem;color:var(--text-dim);"><%= owners[oid].team %></div>
            <% } %>
          </div>
        </a>
      <% } %>
    </div>
  </div>
  <% } %>
</div>

${FOOTER}
${SCRIPTS}
</body>
</html>`;
