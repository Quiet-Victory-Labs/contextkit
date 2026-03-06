import { HEAD, NAV, FOOTER, TIER_BADGE, SCRIPTS } from './shared.js';

export const indexTemplate = `${HEAD}
<body>
${NAV}
${TIER_BADGE}

<section class="hero">
  <div class="hero-eyebrow"><%- siteTitle %></div>
  <h1>Metadata<br><em>Catalog</em></h1>
  <p class="hero-sub">Explore semantic models, governed datasets, business glossary, and data quality tiers.</p>
</section>

<div class="divider"></div>

<main class="page">
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

  <div class="stats reveal">
    <div class="stat">
      <div class="stat-value"><%= modelNames.length %></div>
      <div class="stat-label">Models</div>
    </div>
    <div class="stat">
      <div class="stat-value"><%= totalDatasets %></div>
      <div class="stat-label">Datasets</div>
    </div>
    <div class="stat">
      <div class="stat-value"><%= totalFields %></div>
      <div class="stat-label">Fields</div>
    </div>
    <div class="stat">
      <div class="stat-value"><%= totalTerms %></div>
      <div class="stat-label">Terms</div>
    </div>
    <div class="stat">
      <div class="stat-value"><%= totalOwners %></div>
      <div class="stat-label">Owners</div>
    </div>
  </div>

  <div class="section reveal">
    <div class="section-label">Semantic Models</div>
    <h2 class="section-title">Models</h2>
    <% if (modelNames.length === 0) { %>
      <p style="color:var(--text-muted);">No models found.</p>
    <% } else { %>
      <div class="card-grid">
        <% for (var name of modelNames) { %>
          <div class="card">
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.6rem;">
              <a href="<%= basePath %>/models/<%= name %>.html" style="font-family:var(--mono);font-size:0.95rem;color:var(--gold-light);text-decoration:none;">
                <%= name %>
              </a>
              <% if (tiers[name]) { %><%- tierBadge(tiers[name].tier) %><% } %>
            </div>
            <% if (models[name].description) { %>
              <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.75rem;font-weight:300;"><%= models[name].description %></p>
            <% } %>
            <% if (governance[name]) { %>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                <% if (governance[name].owner) { %>
                  <a href="<%= basePath %>/owners/<%= governance[name].owner %>.html" class="tag tag-nav" style="text-decoration:none;"><%= governance[name].owner %></a>
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
        <% } %>
      </div>
    <% } %>
  </div>

  <% if (Object.keys(owners).length > 0) { %>
  <div class="section reveal">
    <div class="section-label">Data Stewardship</div>
    <h2 class="section-title">Owners</h2>
    <div class="card-grid-sm">
      <% for (var oid of Object.keys(owners)) { %>
        <a href="<%= basePath %>/owners/<%= oid %>.html" class="card" style="text-decoration:none;">
          <div style="font-size:1rem;font-weight:500;color:var(--text);margin-bottom:0.25rem;"><%= owners[oid].display_name %></div>
          <% if (owners[oid].team) { %>
            <div style="font-size:0.78rem;color:var(--text-dim);"><%= owners[oid].team %></div>
          <% } %>
        </a>
      <% } %>
    </div>
  </div>
  <% } %>
</main>

${FOOTER}
${SCRIPTS}
</body>
</html>`;
