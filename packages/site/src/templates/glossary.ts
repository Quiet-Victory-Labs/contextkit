import { HEAD, TOPBAR, SIDEBAR, SIDEBAR_DATA, FOOTER, SCRIPTS } from './shared.js';

export const glossaryTemplate = `${HEAD}
<body>
${TOPBAR}
${SIDEBAR_DATA}
${SIDEBAR}

<div class="main">
  <div class="page-header">
    <h1>Glossary</h1>
    <p class="subtitle">Business term definitions and mappings.</p>
  </div>

  <% var termIds = Object.keys(terms).sort(); %>
  <% if (termIds.length === 0) { %>
    <p style="color:var(--text-secondary);">No terms defined.</p>
  <% } else { %>
    <input type="text" id="glossary-filter"
           placeholder="Filter terms..."
           class="search-input"
           style="margin-bottom:1.5rem;max-width:360px;" />

    <div class="glossary-grid" id="glossary-grid">
      <% for (var tid of termIds) { %>
        <% var term = terms[tid]; %>
        <div class="glossary-card card" id="term-<%= tid %>" data-term="<%= tid %>">
          <div class="glossary-term"><%= tid %></div>
          <div class="glossary-def"><%= term.definition %></div>
          <% if (term.synonyms && term.synonyms.length > 0) { %>
            <div style="display:flex;gap:0.3rem;margin-top:0.5rem;flex-wrap:wrap;">
              <% for (var s of term.synonyms) { %><span class="tag"><%= s %></span><% } %>
            </div>
          <% } %>
          <% if (term.maps_to && term.maps_to.length > 0) { %>
            <div style="display:flex;gap:0.3rem;margin-top:0.35rem;flex-wrap:wrap;">
              <% for (var m of term.maps_to) { %><span class="tag tag-blue"><%= m %></span><% } %>
            </div>
          <% } %>
          <% if (term.owner) { %>
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.4rem;">
              Owner: <a href="<%= basePath %>/owners/<%= term.owner %>.html"><%= term.owner %></a>
            </div>
          <% } %>
        </div>
      <% } %>
    </div>
  <% } %>
</div>

${FOOTER}
${SCRIPTS}
<script>
(function() {
  var input = document.getElementById('glossary-filter');
  if (!input) return;
  var cards = document.querySelectorAll('.glossary-card');
  input.addEventListener('input', function() {
    var q = input.value.toLowerCase();
    cards.forEach(function(card) {
      var text = card.textContent.toLowerCase();
      card.style.display = text.indexOf(q) !== -1 ? '' : 'none';
    });
  });
})();
</script>
</body>
</html>`;
