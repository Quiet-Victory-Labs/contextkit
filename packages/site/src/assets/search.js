/* eslint-disable */
/**
 * Client-side search using MiniSearch.
 * Loads the pre-built search-index.json and provides instant search results.
 */
(function () {
  var basePath = window.__CONTEXTKIT_BASE_PATH__ || '';
  var input = document.getElementById('search-input');
  var resultsContainer = document.getElementById('search-results');
  var miniSearchInstance = null;

  // Load MiniSearch from CDN
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/minisearch@7.1.0/dist/umd/index.min.js';
  script.onload = function () {
    fetch(basePath + '/search-index.json')
      .then(function (res) { return res.text(); })
      .then(function (json) {
        miniSearchInstance = MiniSearch.loadJSON(json, {
          fields: ['id', 'text', 'tags'],
          storeFields: ['id', 'kind', 'text'],
        });
      })
      .catch(function (err) {
        console.error('Failed to load search index:', err);
      });
  };
  document.head.appendChild(script);

  var kindToPath = {
    concept: 'concepts',
    product: 'products',
    policy: 'policies',
    entity: 'concepts',
    term: 'glossary',
  };

  function getHref(result) {
    if (result.kind === 'term') {
      return basePath + '/glossary.html';
    }
    var folder = kindToPath[result.kind] || 'concepts';
    return basePath + '/' + folder + '/' + result.id + '.html';
  }

  function clearResults() {
    if (!resultsContainer) return;
    while (resultsContainer.firstChild) {
      resultsContainer.removeChild(resultsContainer.firstChild);
    }
  }

  function renderResults(results) {
    if (!resultsContainer) return;
    clearResults();

    if (results.length === 0) {
      var noResults = document.createElement('p');
      noResults.className = 'text-gray-500';
      noResults.textContent = 'No results found.';
      resultsContainer.appendChild(noResults);
      return;
    }

    results.forEach(function (r) {
      var card = document.createElement('div');
      card.className = 'bg-white rounded-lg shadow p-4';

      var header = document.createElement('div');
      header.className = 'flex items-center gap-2 mb-1';

      var badge = document.createElement('span');
      badge.className = 'text-xs bg-gray-100 px-1.5 py-0.5 rounded';
      badge.textContent = r.kind;

      var link = document.createElement('a');
      link.href = getHref(r);
      link.className = 'text-blue-600 hover:underline font-medium';
      link.textContent = r.id;

      header.appendChild(badge);
      header.appendChild(link);

      var desc = document.createElement('p');
      desc.className = 'text-sm text-gray-600';
      desc.textContent = (r.text || '').substring(0, 200);

      card.appendChild(header);
      card.appendChild(desc);
      resultsContainer.appendChild(card);
    });
  }

  if (input) {
    input.addEventListener('input', function () {
      var query = input.value.trim();
      if (!query || !miniSearchInstance) {
        clearResults();
        return;
      }
      var results = miniSearchInstance.search(query);
      renderResults(results);
    });
  }
})();
