import type { Manifest, ManifestProduct } from '@runcontext/core';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Returns a single product by ID from the manifest.
 */
export function readProduct(manifest: Manifest, id: string): ReadResourceResult {
  const product: ManifestProduct | undefined = manifest.products.find((p) => p.id === id);
  if (!product) {
    return {
      contents: [
        {
          uri: `context://product/${id}`,
          mimeType: 'application/json',
          text: JSON.stringify({ error: `Product not found: ${id}` }),
        },
      ],
    };
  }
  return {
    contents: [
      {
        uri: `context://product/${id}`,
        mimeType: 'application/json',
        text: JSON.stringify(product, null, 2),
      },
    ],
  };
}

/**
 * Lists all products as resources.
 */
export function listProducts(manifest: Manifest) {
  return {
    resources: manifest.products.map((p) => ({
      uri: `context://product/${p.id}`,
      name: p.id,
      description: p.description,
      mimeType: 'application/json' as const,
    })),
  };
}
