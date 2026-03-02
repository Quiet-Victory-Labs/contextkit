import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Manifest } from '@runcontext/core';

export interface ExplainResult {
  model: Record<string, unknown>;
  governance: Record<string, unknown> | null;
  rules: Record<string, unknown> | null;
  lineage: Record<string, unknown> | null;
  tier: Record<string, unknown> | null;
  owner: Record<string, unknown> | null;
  relatedTerms: Record<string, unknown>[];
}

/**
 * Deep lookup for a model with all related governance context.
 */
export function explainModel(name: string, manifest: Manifest): ExplainResult | null {
  const model = manifest.models[name];
  if (!model) return null;

  const governance = manifest.governance[name] ?? null;
  const rules = manifest.rules[name] ?? null;
  const lineage = manifest.lineage[name] ?? null;
  const tier = manifest.tiers[name] ?? null;

  // Find the owner
  const ownerKey = governance?.owner;
  const owner = ownerKey ? (manifest.owners[ownerKey] ?? null) : null;

  // Find related glossary terms — terms whose tags overlap with model tags
  const modelTags = governance?.tags ?? [];
  const relatedTerms: Record<string, unknown>[] = [];
  for (const [, term] of Object.entries(manifest.terms)) {
    const termTags = term.tags ?? [];
    const hasOverlap = modelTags.some((t) => termTags.includes(t));
    const mapsToModel = term.maps_to?.some((m) => m === name);
    if (hasOverlap || mapsToModel) {
      relatedTerms.push(term as unknown as Record<string, unknown>);
    }
  }

  return {
    model: model as unknown as Record<string, unknown>,
    governance: governance as unknown as Record<string, unknown> | null,
    rules: rules as unknown as Record<string, unknown> | null,
    lineage: lineage as unknown as Record<string, unknown> | null,
    tier: tier as unknown as Record<string, unknown> | null,
    owner: owner as unknown as Record<string, unknown> | null,
    relatedTerms,
  };
}

/**
 * Register the `context_explain` tool.
 * Deep lookup with related governance for a model.
 */
export function registerExplainTool(server: McpServer, manifest: Manifest): void {
  server.tool(
    'context_explain',
    'Deep lookup of a model with all related governance, rules, lineage, tier, owner, and glossary terms',
    { model: z.string().describe('Name of the model to explain') },
    async ({ model }) => {
      const result = explainModel(model, manifest);
      if (!result) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Model '${model}' not found` }),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
