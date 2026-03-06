import { HEAD, NAV, FOOTER, SCRIPTS } from './shared.js';

export const glossaryTemplate = `${HEAD}
<body>
${NAV}

<main class="page">
  <h1 style="font-family:var(--serif);font-weight:300;font-size:clamp(2rem,5vw,3.5rem);color:var(--text);margin-bottom:0.5rem;">Glossary</h1>
  <p style="color:var(--text-muted);font-size:1rem;margin-bottom:2rem;font-weight:300;">Business term definitions and mappings.</p>

  <% var termIds = Object.keys(terms).sort(); %>
  <% if (termIds.length === 0) { %>
    <p style="color:var(--text-muted);">No terms defined.</p>
  <% } else { %>
    <input type="text" id="glossary-filter"
           placeholder="Filter terms..."
           class="search-input"
           style="margin-bottom:2rem;max-width:400px;" />

    <div class="glossary-grid" id="glossary-grid">
      <% for (var tid of termIds) { %>
        <% var term = terms[tid]; %>
        <div class="glossary-card" id="term-<%= tid %>" data-term="<%= tid %>">
          <div class="glossary-term"><%= tid %></div>
          <div class="glossary-def"><%= term.definition %></div>
          <% if (term.synonyms && term.synonyms.length > 0) { %>
            <div style="display:flex;gap:0.4rem;margin-top:0.75rem;flex-wrap:wrap;">
              <% for (var s of term.synonyms) { %><span class="tag"><%= s %></span><% } %>
            </div>
          <% } %>
          <% if (term.maps_to && term.maps_to.length > 0) { %>
            <div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;">
              <% for (var m of term.maps_to) { %><span class="tag tag-blue"><%= m %></span><% } %>
            </div>
          <% } %>
          <% if (term.owner) { %>
            <div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.6rem;">
              Owner: <a href="<%= basePath %>/owners/<%= term.owner %>.html"><%= term.owner %></a>
            </div>
          <% } %>
        </div>
      <% } %>
    </div>
  <% } %>
</main>

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
