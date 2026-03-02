import type { Manifest } from '@contextkit/core';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Returns all terms as a glossary JSON resource.
 */
export function readGlossary(manifest: Manifest): ReadResourceResult {
  const glossary = manifest.terms.map((t) => ({
    id: t.id,
    definition: t.definition,
    synonyms: t.synonyms ?? [],
    mapsTo: t.mapsTo ?? [],
  }));

  return {
    contents: [
      {
        uri: 'context://glossary',
        mimeType: 'application/json',
        text: JSON.stringify(glossary, null, 2),
      },
    ],
  };
}
