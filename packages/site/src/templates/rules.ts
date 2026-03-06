import { HEAD, TOPBAR, SIDEBAR, SIDEBAR_DATA, FOOTER, SCRIPTS } from './shared.js';

export const rulesTemplate = `${HEAD}
<body>
${TOPBAR}
${SIDEBAR_DATA}
${SIDEBAR}

<div class="main">
  <div class="breadcrumb">
    <a href="<%= basePath %>/index.html">Home</a>
    <span class="breadcrumb-sep">/</span>
    <a href="<%= basePath %>/models/<%= modelName %>.html"><%= modelName %></a>
    <span class="breadcrumb-sep">/</span>
    <span>Rules</span>
  </div>

  <div class="page-header">
    <h1><%= modelName %> <span style="color:var(--text-dim);font-weight:300;">&mdash; Rules &amp; Queries</span></h1>
  </div>

  <% if (rules && rules.golden_queries && rules.golden_queries.length > 0) { %>
  <div class="section">
    <div class="section-label">Golden Queries</div>
    <h2 class="section-title">Pre-validated questions</h2>
    <% for (var gq of rules.golden_queries) { %>
      <div class="query-card">
        <div class="query-q">
          <span class="query-q-badge">Q</span>
          <span><%= gq.question %></span>
        </div>
        <div class="query-sql sql-highlight"><%= gq.sql %></div>
        <% if (gq.dialect || (gq.tags && gq.tags.length > 0)) { %>
        <div class="query-meta">
          <% if (gq.dialect) { %><span>Dialect: <%= gq.dialect %></span><% } %>
          <% if (gq.tags && gq.tags.length > 0) { %><span>Tags: <%= gq.tags.join(', ') %></span><% } %>
        </div>
        <% } %>
      </div>
    <% } %>
  </div>
  <% } %>

  <% if (rules && rules.business_rules && rules.business_rules.length > 0) { %>
  <div class="section">
    <div class="section-label">Business Rules</div>
    <h2 class="section-title">Business Rules</h2>
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      <% for (var br of rules.business_rules) { %>
        <div class="card">
          <div style="font-family:var(--mono);font-size:0.82rem;color:var(--accent-light);margin-bottom:0.3rem;font-weight:500;"><%= br.name %></div>
          <p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;font-weight:300;"><%= br.definition %></p>
          <% if (br.enforcement && br.enforcement.length > 0) { %>
            <div style="display:flex;gap:0.3rem;margin-top:0.5rem;flex-wrap:wrap;">
              <% for (var e of br.enforcement) { %><span class="tag tag-green"><%= e %></span><% } %>
            </div>
          <% } %>
          <% if (br.avoid && br.avoid.length > 0) { %>
            <div style="display:flex;gap:0.3rem;margin-top:0.3rem;flex-wrap:wrap;">
              <% for (var a of br.avoid) { %><span class="tag tag-red"><%= a %></span><% } %>
            </div>
          <% } %>
        </div>
      <% } %>
    </div>
  </div>
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
        <% if (gf.tables && gf.tables.length > 0) { %>
          <div style="display:flex;gap:0.3rem;margin-top:0.4rem;">
            <% for (var tb of gf.tables) { %><span class="tag"><%= tb %></span><% } %>
          </div>
        <% } %>
      </div>
    <% } %>
  </div>
  <% } %>

  <% if (rules && rules.hierarchies && rules.hierarchies.length > 0) { %>
  <div class="section">
    <div class="section-label">Drill Paths</div>
    <h2 class="section-title">Hierarchies</h2>
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      <% for (var h of rules.hierarchies) { %>
        <div class="card">
          <div style="font-family:var(--mono);font-size:0.82rem;color:var(--accent-light);margin-bottom:0.3rem;font-weight:500;"><%= h.name %></div>
          <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.3rem;">Dataset: <span class="mono"><%= h.dataset %></span></div>
          <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
            <% for (var li = 0; li < h.levels.length; li++) { %>
              <span class="tag tag-blue"><%= h.levels[li] %></span>
              <% if (li < h.levels.length - 1) { %><span style="color:var(--text-dim);">&rarr;</span><% } %>
            <% } %>
          </div>
        </div>
      <% } %>
    </div>
  </div>
  <% } %>

  <% if (!rules || ((!rules.golden_queries || rules.golden_queries.length === 0) && (!rules.business_rules || rules.business_rules.length === 0) && (!rules.guardrail_filters || rules.guardrail_filters.length === 0) && (!rules.hierarchies || rules.hierarchies.length === 0))) { %>
    <p style="color:var(--text-secondary);">No rules or queries defined for this model.</p>
  <% } %>
</div>

${FOOTER}
${SCRIPTS}
</body>
</html>`;
