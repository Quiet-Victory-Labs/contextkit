import { HEAD, NAV, FOOTER, SCRIPTS } from './shared.js';

export const searchTemplate = `${HEAD}
<body>
${NAV}

<main class="page">
  <h1 style="font-family:var(--serif);font-weight:300;font-size:clamp(2rem,5vw,3.5rem);color:var(--text);margin-bottom:2rem;">Search</h1>

  <input type="text" id="search-input"
         placeholder="Search models, datasets, terms..."
         class="search-input"
         style="margin-bottom:2rem;" />

  <div id="search-results" style="display:flex;flex-direction:column;gap:0.75rem;"></div>
</main>

${FOOTER}
${SCRIPTS}

<script src="https://cdn.jsdelivr.net/npm/minisearch@7.1.0/dist/umd/index.min.js"></script>
<script>
(function() {
  var indexData = <%- searchIndexJson %>;
  var miniSearch = MiniSearch.loadJSON(JSON.stringify(indexData.index), indexData.options);

  var input = document.getElementById('search-input');
  var resultsContainer = document.getElementById('search-results');
  var docs = indexData.documents;

  var typeColors = {
    model: 'tag-gold',
    dataset: 'tag-blue',
    term: 'tag-green',
    owner: 'tag-bronze'
  };

  function clearResults() {
    while (resultsContainer.firstChild) {
      resultsContainer.removeChild(resultsContainer.firstChild);
    }
  }

  function createResultElement(doc) {
    var wrapper = document.createElement('div');
    wrapper.className = 'card';
    wrapper.style.padding = '1rem 1.25rem';

    var top = document.createElement('div');
    top.style.display = 'flex';
    top.style.alignItems = 'center';
    top.style.gap = '0.5rem';

    var link = document.createElement('a');
    link.href = doc.url;
    link.style.fontFamily = 'var(--mono)';
    link.style.fontSize = '0.88rem';
    link.style.color = 'var(--gold-light)';
    link.textContent = doc.title;
    top.appendChild(link);

    var badge = document.createElement('span');
    badge.className = 'tag ' + (typeColors[doc.type] || '');
    badge.textContent = doc.type;
    top.appendChild(badge);

    wrapper.appendChild(top);

    if (doc.description) {
      var desc = document.createElement('p');
      desc.style.fontSize = '0.82rem';
      desc.style.color = 'var(--text-muted)';
      desc.style.marginTop = '0.3rem';
      desc.style.fontWeight = '300';
      desc.textContent = doc.description;
      wrapper.appendChild(desc);
    }

    return wrapper;
  }

  input.addEventListener('input', function() {
    var query = input.value.trim();
    clearResults();
    if (!query) return;
    var hits = miniSearch.search(query, { prefix: true, fuzzy: 0.2 });
    if (hits.length === 0) {
      var noResults = document.createElement('p');
      noResults.style.color = 'var(--text-muted)';
      noResults.textContent = 'No results found.';
      resultsContainer.appendChild(noResults);
      return;
    }
    hits.slice(0, 20).forEach(function(hit) {
      var doc = docs[hit.id];
      if (doc) {
        resultsContainer.appendChild(createResultElement(doc));
      }
    });
  });
})();
</script>
</body>
</html>`;
