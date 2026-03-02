import type { Manifest, ManifestPolicy } from '@runcontext/core';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Returns a single policy by ID from the manifest.
 */
export function readPolicy(manifest: Manifest, id: string): ReadResourceResult {
  const policy: ManifestPolicy | undefined = manifest.policies.find((p) => p.id === id);
  if (!policy) {
    return {
      contents: [
        {
          uri: `context://policy/${id}`,
          mimeType: 'application/json',
          text: JSON.stringify({ error: `Policy not found: ${id}` }),
        },
      ],
    };
  }
  return {
    contents: [
      {
        uri: `context://policy/${id}`,
        mimeType: 'application/json',
        text: JSON.stringify(policy, null, 2),
      },
    ],
  };
}

/**
 * Lists all policies as resources.
 */
export function listPolicies(manifest: Manifest) {
  return {
    resources: manifest.policies.map((p) => ({
      uri: `context://policy/${p.id}`,
      name: p.id,
      description: p.description,
      mimeType: 'application/json' as const,
    })),
  };
}
