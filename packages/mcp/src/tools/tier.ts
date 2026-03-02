import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ContextGraph, TierScore } from '@runcontext/core';
import { computeTier } from '@runcontext/core';

/**
 * Compute the tier for a model from the context graph.
 */
export function computeModelTier(modelName: string, graph: ContextGraph): TierScore | null {
  if (!graph.models.has(modelName)) return null;
  return computeTier(modelName, graph);
}

/**
 * Register the `context_tier` tool.
 * Computes the tier scorecard for a specified model.
 */
export function registerTierTool(server: McpServer, graph: ContextGraph): void {
  server.tool(
    'context_tier',
    'Compute the metadata tier (none/bronze/silver/gold) for a model with detailed check results',
    { model: z.string().describe('Name of the model to tier') },
    async ({ model }) => {
      const result = computeModelTier(model, graph);
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
