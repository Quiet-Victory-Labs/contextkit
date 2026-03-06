import { HEAD, NAV, FOOTER, TIER_BADGE, SCRIPTS } from './shared.js';

export const ownerTemplate = `${HEAD}
<body>
${NAV}
${TIER_BADGE}

<main class="page">
  <a href="<%= basePath %>/" class="back-link">&larr; All Models</a>

  <h1 style="font-family:var(--serif);font-weight:300;font-size:clamp(2rem,5vw,3.5rem);color:var(--text);margin-bottom:0.5rem;"><%= owner.display_name %></h1>

  <div style="display:flex;gap:1.5rem;font-size:0.85rem;color:var(--text-dim);margin-bottom:1.5rem;">
    <% if (owner.email) { %><span>Email: <span style="color:var(--text-muted);"><%= owner.email %></span></span><% } %>
    <% if (owner.team) { %><span>Team: <span style="color:var(--text-muted);"><%= owner.team %></span></span><% } %>
  </div>

  <% if (owner.description) { %>
    <p style="color:var(--text-muted);font-size:0.95rem;margin-bottom:2rem;font-weight:300;max-width:600px;"><%= owner.description %></p>
  <% } %>

  <% if (governedModels.length > 0) { %>
  <div class="section reveal">
    <div class="section-label">Stewardship</div>
    <h2 class="section-title">Governed Models</h2>
    <div class="card-grid-sm">
      <% for (var gm of governedModels) { %>
        <a href="<%= basePath %>/models/<%= gm.name %>.html" class="card" style="text-decoration:none;">
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <span class="mono" style="color:var(--gold-light);"><%= gm.name %></span>
            <% if (gm.tier) { %><%- tierBadge(gm.tier) %><% } %>
          </div>
        </a>
      <% } %>
    </div>
  </div>
  <% } else { %>
    <p style="color:var(--text-muted);">No models governed by this owner.</p>
  <% } %>
</main>

${FOOTER}
${SCRIPTS}
</body>
</html>`;
