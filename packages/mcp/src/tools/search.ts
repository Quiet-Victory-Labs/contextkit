import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Manifest } from '@runcontext/core';

export interface SearchResult {
  type: 'model' | 'dataset' | 'field' | 'term' | 'owner';
  name: string;
  description?: string;
  model?: string;
  dataset?: string;
}

/**
 * Perform keyword search across all node types in the manifest.
 */
export function searchManifest(manifest: Manifest, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const q = query.toLowerCase();

  // Search models
  for (const [name, model] of Object.entries(manifest.models)) {
    if (
      name.toLowerCase().includes(q) ||
      model.description?.toLowerCase().includes(q)
    ) {
      results.push({
        type: 'model',
        name,
        description: model.description,
      });
    }

    // Search datasets
    for (const ds of model.datasets ?? []) {
      if (
        ds.name.toLowerCase().includes(q) ||
        ds.description?.toLowerCase().includes(q)
      ) {
        results.push({
          type: 'dataset',
          name: ds.name,
          description: ds.description,
          model: name,
        });
      }

      // Search fields
      if (ds.fields) {
        for (const field of ds.fields) {
          if (
            field.name.toLowerCase().includes(q) ||
            field.description?.toLowerCase().includes(q) ||
            field.label?.toLowerCase().includes(q)
          ) {
            results.push({
              type: 'field',
              name: field.name,
              description: field.description,
              model: name,
              dataset: ds.name,
            });
          }
        }
      }
    }
  }

  // Search terms
  for (const [id, term] of Object.entries(manifest.terms)) {
    if (
      id.toLowerCase().includes(q) ||
      term.definition.toLowerCase().includes(q) ||
      term.synonyms?.some((s) => s.toLowerCase().includes(q))
    ) {
      results.push({
        type: 'term',
        name: id,
        description: term.definition,
      });
    }
  }

  // Search owners
  for (const [id, owner] of Object.entries(manifest.owners)) {
    if (
      id.toLowerCase().includes(q) ||
      owner.display_name.toLowerCase().includes(q) ||
      owner.description?.toLowerCase().includes(q)
    ) {
      results.push({
        type: 'owner',
        name: id,
        description: owner.display_name,
      });
    }
  }

  return results;
}

/**
 * Register the `context_search` tool.
 * Keyword search across all node types (models, datasets, fields, terms, owners).
 */
export function registerSearchTool(server: McpServer, manifest: Manifest): void {
  server.tool(
    'context_search',
    'Search across all ContextKit nodes (models, datasets, fields, terms, owners) by keyword',
    { query: z.string().describe('Keyword to search for') },
    async ({ query }) => {
      const results = searchManifest(manifest, query);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}
