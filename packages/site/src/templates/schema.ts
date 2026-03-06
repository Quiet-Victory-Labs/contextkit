import { HEAD, NAV, FOOTER, TIER_BADGE, SCRIPTS } from './shared.js';

export const schemaTemplate = `${HEAD}
<body>
${NAV}
${TIER_BADGE}

<main class="page">
  <a href="<%= basePath %>/models/<%= model.name %>.html" class="back-link">&larr; Back to <%= model.name %></a>

  <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:2rem;">
    <h1 style="font-family:var(--serif);font-weight:300;font-size:clamp(1.8rem,4vw,2.8rem);color:var(--text);"><%= model.name %></h1>
    <% if (tier) { %><%- tierBadge(tier.tier) %><% } %>
    <span style="font-size:0.85rem;color:var(--text-dim);">Schema Browser</span>
  </div>

  <% if (model.datasets && model.datasets.length > 0) { %>
    <% for (var i = 0; i < model.datasets.length; i++) { var ds = model.datasets[i]; %>
      <% var dsGov = gov && gov.datasets && gov.datasets[ds.name]; %>
      <div class="section reveal">
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
            <div style="display:flex;align-items:center;gap:0.6rem;">
              <span class="mono" style="font-size:1rem;color:var(--text);"><%= ds.name %></span>
              <% if (dsGov && dsGov.table_type) { %>
                <span class="ds-type ds-type-<%= dsGov.table_type %>"><%= dsGov.table_type %></span>
              <% } %>
            </div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
              <% if (dsGov && dsGov.grain) { %><span class="tag"><%= dsGov.grain %></span><% } %>
              <% if (dsGov && dsGov.refresh) { %><span class="tag"><%= dsGov.refresh %></span><% } %>
              <% if (dsGov && dsGov.security) { %><span class="tag"><%= dsGov.security %></span><% } %>
            </div>
          </div>
          <div style="padding:0 1.5rem 0.5rem;font-size:0.75rem;color:var(--text-dim);font-family:var(--mono);padding-top:0.75rem;">
            Source: <%= ds.source %>
          </div>
          <% if (ds.description) { %>
            <div style="padding:0 1.5rem 1rem;font-size:0.85rem;color:var(--text-muted);font-weight:300;"><%= ds.description %></div>
          <% } %>

          <% if (ds.fields && ds.fields.length > 0) { %>
            <table class="table-dark">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Description</th>
                  <th>Semantic Role</th>
                  <th>Aggregation</th>
                </tr>
              </thead>
              <tbody>
                <% for (var field of ds.fields) { %>
                  <% var fieldKey = ds.name + '.' + field.name; %>
                  <% var fGov = gov && gov.fields && gov.fields[fieldKey]; %>
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
          <% } else { %>
            <p style="padding:1.5rem;color:var(--text-dim);font-size:0.85rem;">No fields defined.</p>
          <% } %>
        </div>
      </div>
    <% } %>
  <% } else { %>
    <p style="color:var(--text-muted);">No datasets found.</p>
  <% } %>
</main>

${FOOTER}
${SCRIPTS}
</body>
</html>`;
