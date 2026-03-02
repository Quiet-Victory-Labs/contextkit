import type { Manifest } from '@runcontext/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

interface SearchableItem {
  kind: string;
  id: string;
  definition?: string;
  description?: string;
  tags?: string[];
}

/**
 * Searches across all concepts, products, policies, entities, and terms
 * in the manifest. Matches case-insensitively on id, definition/description,
 * and tags.
 */
export function searchContext(manifest: Manifest, query: string): CallToolResult {
  const q = query.toLowerCase();

  const items: SearchableItem[] = [
    ...manifest.concepts.map((c) => ({
      kind: 'concept' as const,
      id: c.id,
      definition: c.definition,
      tags: c.tags,
    })),
    ...manifest.products.map((p) => ({
      kind: 'product' as const,
      id: p.id,
      description: p.description,
      tags: p.tags,
    })),
    ...manifest.policies.map((p) => ({
      kind: 'policy' as const,
      id: p.id,
      description: p.description,
      tags: p.tags,
    })),
    ...manifest.entities.map((e) => ({
      kind: 'entity' as const,
      id: e.id,
      definition: e.definition,
      tags: e.tags,
    })),
    ...manifest.terms.map((t) => ({
      kind: 'term' as const,
      id: t.id,
      definition: t.definition,
      tags: t.tags,
    })),
  ];

  const matches = items.filter((item) => {
    if (item.id.toLowerCase().includes(q)) return true;
    if (item.definition && item.definition.toLowerCase().includes(q)) return true;
    if (item.description && item.description.toLowerCase().includes(q)) return true;
    if (item.tags && item.tags.some((tag) => tag.toLowerCase().includes(q))) return true;
    return false;
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ query, resultCount: matches.length, results: matches }, null, 2),
      },
    ],
  };
}
