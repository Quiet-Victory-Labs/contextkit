import { HEAD, TOPBAR, SIDEBAR, SIDEBAR_DATA, FOOTER, TIER_BADGE, SCRIPTS } from './shared.js';

export const ownerTemplate = `${HEAD}
<body>
${TOPBAR}
${SIDEBAR_DATA}
${SIDEBAR}
${TIER_BADGE}

<div class="main">
  <div class="breadcrumb">
    <a href="<%= basePath %>/index.html">Home</a>
    <span class="breadcrumb-sep">/</span>
    <span><%= owner.display_name %></span>
  </div>

  <div class="page-header">
    <h1>
      <% if (typeof studioMode !== 'undefined' && studioMode) { %>
        <span class="editable" data-file="context/owners/<%= owner.id %>.owner.yaml" data-path="display_name" data-label="<%= owner.id %> display name"><%= owner.display_name || 'Add display name' %></span>
      <% } else { %>
        <%= owner.display_name %>
      <% } %>
    </h1>
  </div>

  <div style="display:flex;gap:1.25rem;font-size:0.82rem;color:var(--text-dim);margin-bottom:1.5rem;">
    <% if (typeof studioMode !== 'undefined' && studioMode) { %>
      <span>Email: <span class="editable" data-file="context/owners/<%= owner.id %>.owner.yaml" data-path="email" data-label="<%= owner.id %> email" style="color:var(--text-secondary);"><%= owner.email || 'Add email' %></span></span>
      <span>Team: <span class="editable" data-file="context/owners/<%= owner.id %>.owner.yaml" data-path="team" data-label="<%= owner.id %> team" style="color:var(--text-secondary);"><%= owner.team || 'Add team' %></span></span>
    <% } else { %>
      <% if (owner.email) { %><span>Email: <span style="color:var(--text-secondary);"><%= owner.email %></span></span><% } %>
      <% if (owner.team) { %><span>Team: <span style="color:var(--text-secondary);"><%= owner.team %></span></span><% } %>
    <% } %>
  </div>

  <% if (owner.description) { %>
    <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:2rem;font-weight:300;max-width:560px;"><%= owner.description %></p>
  <% } %>

  <% if (governedModels.length > 0) { %>
  <div class="section">
    <div class="section-label">Stewardship</div>
    <h2 class="section-title">Governed Models</h2>
    <div class="card-grid">
      <% for (var gm of governedModels) { %>
        <a href="<%= basePath %>/models/<%= gm.name %>.html" class="card-link">
          <div class="card">
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <span class="mono" style="font-size:0.85rem;color:var(--accent-light);"><%= gm.name %></span>
              <% if (gm.tier) { %><%- tierBadge(gm.tier) %><% } %>
            </div>
          </div>
        </a>
      <% } %>
    </div>
  </div>
  <% } else { %>
    <p style="color:var(--text-secondary);">No models governed by this owner.</p>
  <% } %>
</div>

${FOOTER}
${SCRIPTS}
</body>
</html>`;
