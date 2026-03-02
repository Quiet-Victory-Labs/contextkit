/**
 * Builds a MiniSearch index from a Manifest for client-side search.
 *
 * The index is serialized to JSON so it can be embedded in the search page
 * and loaded by MiniSearch on the client side.
 */

import MiniSearch from 'minisearch';
import type { Manifest } from '@runcontext/core';

export interface SearchDocument {
  id: string;
  type: string;
  title: string;
  description: string;
  url: string;
}

export interface SearchIndex {
  /** Serialized MiniSearch index (JSON-parsed object). */
  index: unknown;
  /** MiniSearch constructor options needed to reload the index. */
  options: {
    fields: string[];
    storeFields: string[];
    idField: string;
  };
  /** Map of document ID to document metadata for rendering results. */
  documents: Record<string, SearchDocument>;
}

const MINISEARCH_OPTIONS = {
  fields: ['title', 'description', 'type'],
  storeFields: ['title', 'description', 'type', 'url'],
  idField: 'id',
};

/**
 * Build a search index from a manifest.
 *
 * @param manifest - The compiled ContextKit manifest
 * @param basePath - The base URL path for links (e.g. '' or '/docs')
 * @returns A SearchIndex object ready for JSON serialization
 */
export function buildSearchIndex(manifest: Manifest, basePath: string): SearchIndex {
  const docs: SearchDocument[] = [];
  let idCounter = 0;

  // Index models
  for (const [name, model] of Object.entries(manifest.models)) {
    docs.push({
      id: String(idCounter++),
      type: 'model',
      title: name,
      description: model.description ?? '',
      url: `${basePath}/models/${name}.html`,
    });

    // Index datasets within each model
    if (model.datasets) {
      for (const ds of model.datasets) {
        docs.push({
          id: String(idCounter++),
          type: 'dataset',
          title: `${name} / ${ds.name}`,
          description: ds.description ?? '',
          url: `${basePath}/models/${name}/schema.html`,
        });
      }
    }
  }

  // Index glossary terms
  for (const [termId, term] of Object.entries(manifest.terms)) {
    docs.push({
      id: String(idCounter++),
      type: 'term',
      title: termId,
      description: term.definition,
      url: `${basePath}/glossary.html#term-${termId}`,
    });
  }

  // Index owners
  for (const [oid, owner] of Object.entries(manifest.owners)) {
    docs.push({
      id: String(idCounter++),
      type: 'owner',
      title: owner.display_name,
      description: owner.description ?? '',
      url: `${basePath}/owners/${oid}.html`,
    });
  }

  // Build MiniSearch index
  const miniSearch = new MiniSearch(MINISEARCH_OPTIONS);
  miniSearch.addAll(docs);

  // Create document lookup map by id
  const documentsMap: Record<string, SearchDocument> = {};
  for (const doc of docs) {
    documentsMap[doc.id] = doc;
  }

  return {
    index: JSON.parse(JSON.stringify(miniSearch)),
    options: MINISEARCH_OPTIONS,
    documents: documentsMap,
  };
}
