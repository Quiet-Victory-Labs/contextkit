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
          <div class="glossary-def">
            <% if (typeof studioMode !== 'undefined' && studioMode) { %>
              <span class="editable" data-file="context/glossary/<%= tid %>.term.yaml" data-path="definition" data-label="<%= tid %> definition"><%= term.definition || 'Add definition' %></span>
            <% } else { %>
              <%= term.definition || '' %>
            <% } %>
          </div>
          <% if (typeof studioMode !== 'undefined' && studioMode) { %>
            <div style="display:flex;gap:0.3rem;margin-top:0.5rem;flex-wrap:wrap;">
              <span class="editable" data-file="context/glossary/<%= tid %>.term.yaml" data-path="synonyms" data-label="<%= tid %> synonyms" style="font-size:0.78rem;color:var(--text-dim);"><%= (term.synonyms && term.synonyms.length > 0) ? term.synonyms.join(', ') : 'Add synonyms (comma-separated)' %></span>
            </div>
          <% } else if (term.synonyms && term.synonyms.length > 0) { %>
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

    <% if (typeof studioMode !== 'undefined' && studioMode) { %>
      <div id="add-term-container" style="margin-top:1.5rem;">
        <button class="studio-add-btn" id="add-term-btn" onclick="document.getElementById('add-term-form').style.display='block';this.style.display='none';">+ Add Term</button>
        <div id="add-term-form" class="card" style="display:none;padding:1.25rem;margin-top:0.5rem;">
          <div style="font-size:0.85rem;color:#c9a55a;margin-bottom:1rem;font-weight:500;">New Glossary Term</div>
          <div style="margin-bottom:0.75rem;">
            <label style="display:block;font-size:0.75rem;color:var(--text-dim);margin-bottom:0.25rem;">Term ID (slug)</label>
            <input type="text" id="new-term-id" placeholder="e.g. churn_rate" style="width:100%;padding:6px 10px;background:var(--bg-card);border:1px solid #333;border-radius:6px;color:var(--text-primary);font-size:0.85rem;" />
          </div>
          <div style="margin-bottom:0.75rem;">
            <label style="display:block;font-size:0.75rem;color:var(--text-dim);margin-bottom:0.25rem;">Definition</label>
            <input type="text" id="new-term-def" placeholder="What this term means" style="width:100%;padding:6px 10px;background:var(--bg-card);border:1px solid #333;border-radius:6px;color:var(--text-primary);font-size:0.85rem;" />
          </div>
          <div style="margin-bottom:0.75rem;">
            <label style="display:block;font-size:0.75rem;color:var(--text-dim);margin-bottom:0.25rem;">Synonyms (comma-separated)</label>
            <input type="text" id="new-term-synonyms" placeholder="e.g. attrition, turnover" style="width:100%;padding:6px 10px;background:var(--bg-card);border:1px solid #333;border-radius:6px;color:var(--text-primary);font-size:0.85rem;" />
          </div>
          <div style="margin-bottom:0.75rem;">
            <label style="display:block;font-size:0.75rem;color:var(--text-dim);margin-bottom:0.25rem;">Tags (comma-separated)</label>
            <input type="text" id="new-term-tags" placeholder="e.g. finance, metrics" style="width:100%;padding:6px 10px;background:var(--bg-card);border:1px solid #333;border-radius:6px;color:var(--text-primary);font-size:0.85rem;" />
          </div>
          <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
            <button onclick="document.getElementById('add-term-form').style.display='none';document.getElementById('add-term-btn').style.display='';" style="background:none;border:1px solid #555;color:var(--text-secondary);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.82rem;">Cancel</button>
            <button onclick="submitNewTerm()" style="background:#c9a55a;border:none;color:#000;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.82rem;font-weight:500;">Stage Term</button>
          </div>
        </div>
      </div>
    <% } %>
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
<% if (typeof studioMode !== 'undefined' && studioMode) { %>
<script>
function submitNewTerm() {
  var id = document.getElementById('new-term-id').value.trim();
  var def = document.getElementById('new-term-def').value.trim();
  var syns = document.getElementById('new-term-synonyms').value.trim();
  var tags = document.getElementById('new-term-tags').value.trim();
  if (!id) { alert('Term ID is required.'); return; }
  var file = 'context/glossary/' + id + '.term.yaml';
  if (def) stageEdit(file, 'definition', def, id + ' definition');
  if (syns) {
    var synList = syns.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    stageEdit(file, 'synonyms', synList, id + ' synonyms');
  }
  if (tags) {
    var tagList = tags.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    stageEdit(file, 'tags', tagList, id + ' tags');
  }
  document.getElementById('add-term-form').style.display = 'none';
  document.getElementById('add-term-btn').style.display = '';
  document.getElementById('new-term-id').value = '';
  document.getElementById('new-term-def').value = '';
  document.getElementById('new-term-synonyms').value = '';
  document.getElementById('new-term-tags').value = '';
}
</script>
<% } %>
</body>
</html>`;
