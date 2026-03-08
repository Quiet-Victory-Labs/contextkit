import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Manifest } from '@runcontext/core';

export interface ProductSummary {
  name: string;
  modelCount: number;
  models: string[];
}

export function listProducts(manifest: Manifest): ProductSummary[] {
  if (!manifest.products) return [];
  return Object.entries(manifest.products).map(([name, product]) => ({
    name,
    modelCount: Object.keys(product.models).length,
    models: Object.keys(product.models),
  }));
}

export function registerListProductsTool(server: McpServer, manifest: Manifest): void {
  server.tool(
    'list_products',
    'List all data products in the semantic plane with their models',
    {},
    async () => {
      const products = listProducts(manifest);
      if (products.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No data products found. This is a single-product semantic plane.' }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(products, null, 2) }],
      };
    },
  );
}
