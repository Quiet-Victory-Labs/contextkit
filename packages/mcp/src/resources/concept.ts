import type { Manifest, ManifestConcept } from '@contextkit/core';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Returns a single concept by ID from the manifest.
 */
export function readConcept(manifest: Manifest, id: string): ReadResourceResult {
  const concept: ManifestConcept | undefined = manifest.concepts.find((c) => c.id === id);
  if (!concept) {
    return {
      contents: [
        {
          uri: `context://concept/${id}`,
          mimeType: 'application/json',
          text: JSON.stringify({ error: `Concept not found: ${id}` }),
        },
      ],
    };
  }
  return {
    contents: [
      {
        uri: `context://concept/${id}`,
        mimeType: 'application/json',
        text: JSON.stringify(concept, null, 2),
      },
    ],
  };
}

/**
 * Lists all concepts as resources.
 */
export function listConcepts(manifest: Manifest) {
  return {
    resources: manifest.concepts.map((c) => ({
      uri: `context://concept/${c.id}`,
      name: c.id,
      description: c.definition,
      mimeType: 'application/json' as const,
    })),
  };
}
