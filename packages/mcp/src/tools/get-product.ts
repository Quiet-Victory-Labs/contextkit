import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Manifest } from '@runcontext/core';

export function getProduct(manifest: Manifest, name: string) {
  if (!manifest.products) return null;
  const product = manifest.products[name];
  if (!product) return null;

  // Gather tiers for this product's models
  const tiers: Record<string, unknown> = {};
  for (const modelName of Object.keys(product.models)) {
    if (manifest.tiers[modelName]) {
      tiers[modelName] = manifest.tiers[modelName];
    }
  }

  return {
    name,
    models: product.models,
    governance: product.governance,
    rules: product.rules,
    lineage: product.lineage,
    tiers,
  };
}

export function registerGetProductTool(server: McpServer, manifest: Manifest): void {
  server.tool(
    'get_product',
    'Get full metadata for a specific data product including models, governance, rules, lineage, and tiers',
    { name: z.string().describe('The data product name') },
    async ({ name }) => {
      const product = getProduct(manifest, name);
      if (!product) {
        return {
          content: [{ type: 'text' as const, text: `Data product "${name}" not found.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(product, null, 2) }],
      };
    },
  );
}
