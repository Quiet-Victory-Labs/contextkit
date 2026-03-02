import MiniSearch from 'minisearch';
import type { Manifest } from '@contextkit/core';

export interface SearchDocument {
  id: string;
  kind: string;
  text: string;
  tags: string;
}

/**
 * Build a MiniSearch index from the manifest and return the serialized JSON string.
 * The client-side search.js will load this JSON and use MiniSearch.loadJSON().
 */
export function buildSearchIndex(manifest: Manifest): string {
  const miniSearch = new MiniSearch<SearchDocument>({
    fields: ['id', 'text', 'tags'],
    storeFields: ['id', 'kind', 'text'],
    searchOptions: {
      boost: { id: 2 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const documents: SearchDocument[] = [];

  for (const concept of manifest.concepts) {
    documents.push({
      id: concept.id,
      kind: 'concept',
      text: concept.definition,
      tags: (concept.tags ?? []).join(' '),
    });
  }

  for (const product of manifest.products) {
    documents.push({
      id: product.id,
      kind: 'product',
      text: product.description,
      tags: (product.tags ?? []).join(' '),
    });
  }

  for (const policy of manifest.policies) {
    documents.push({
      id: policy.id,
      kind: 'policy',
      text: policy.description,
      tags: (policy.tags ?? []).join(' '),
    });
  }

  for (const entity of manifest.entities) {
    documents.push({
      id: entity.id,
      kind: 'entity',
      text: entity.definition ?? '',
      tags: (entity.tags ?? []).join(' '),
    });
  }

  for (const term of manifest.terms) {
    documents.push({
      id: term.id,
      kind: 'term',
      text: term.definition,
      tags: (term.tags ?? []).join(' '),
    });
  }

  miniSearch.addAll(documents);

  return JSON.stringify(miniSearch);
}
