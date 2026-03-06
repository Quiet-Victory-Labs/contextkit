import { HEAD, TOPBAR, SIDEBAR, SIDEBAR_DATA, FOOTER, TIER_BADGE, SCRIPTS } from './shared.js';

export const schemaTemplate = `${HEAD}
<body>
${TOPBAR}
${SIDEBAR_DATA}
${SIDEBAR}
${TIER_BADGE}

<div class="main">
  <div class="breadcrumb">
    <a href="<%= basePath %>/index.html">Home</a>
    <span class="breadcrumb-sep">/</span>
    <a href="<%= basePath %>/models/<%= model.name %>.html"><%= model.name %></a>
    <span class="breadcrumb-sep">/</span>
    <span>Schema</span>
  </div>

  <div class="page-header">
    <div style="display:flex;align-items:center;gap:0.6rem;">
      <h1><%= model.name %></h1>
      <% if (tier) { %><%- tierBadge(tier.tier) %><% } %>
      <span style="font-size:0.8rem;color:var(--text-dim);">Schema Browser</span>
    </div>
  </div>

  <% if (model.datasets && model.datasets.length > 0) { %>
    <% for (var i = 0; i < model.datasets.length; i++) { var ds = model.datasets[i]; %>
      <% var dsGov = gov && gov.datasets && gov.datasets[ds.name]; %>
      <div class="section">
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span class="mono" style="font-size:0.9rem;color:var(--text);"><%= ds.name %></span>
              <% if (dsGov && dsGov.table_type) { %>
                <span class="tag ds-<%= dsGov.table_type %>"><%= dsGov.table_type %></span>
              <% } %>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              <% if (dsGov && dsGov.grain) { %><span class="tag"><%= dsGov.grain %></span><% } %>
              <% if (dsGov && dsGov.refresh) { %><span class="tag"><%= dsGov.refresh %></span><% } %>
              <% if (dsGov && dsGov.security) { %><span class="tag"><%= dsGov.security %></span><% } %>
            </div>
          </div>
          <div style="padding:0.5rem 1.25rem;font-size:0.72rem;color:var(--text-dim);font-family:var(--mono);">
            Source: <%= ds.source %>
          </div>
          <% if (ds.description) { %>
            <div style="padding:0 1.25rem 0.75rem;font-size:0.82rem;color:var(--text-secondary);font-weight:300;"><%= ds.description %></div>
          <% } %>

          <% if (ds.fields && ds.fields.length > 0) { %>
            <table class="data-table">
              <thead>
                <tr><th>Field</th><th>Description</th><th>Semantic Role</th><th>Aggregation</th></tr>
              </thead>
              <tbody>
                <% for (var field of ds.fields) { %>
                  <% var fieldKey = ds.name + '.' + field.name; %>
                  <% var fGov = gov && gov.fields && gov.fields[fieldKey]; %>
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
          <% } else { %>
            <p style="padding:1.25rem;color:var(--text-dim);font-size:0.82rem;">No fields defined.</p>
          <% } %>
        </div>
      </div>
    <% } %>
  <% } else { %>
    <p style="color:var(--text-secondary);">No datasets found.</p>
  <% } %>
</div>

${FOOTER}
${SCRIPTS}
</body>
</html>`;
