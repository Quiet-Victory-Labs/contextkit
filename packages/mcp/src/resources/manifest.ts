import type { Manifest } from '@runcontext/core';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Returns the full manifest as a JSON resource.
 */
export function readManifest(manifest: Manifest): ReadResourceResult {
  return {
    contents: [
      {
        uri: 'context://manifest',
        mimeType: 'application/json',
        text: JSON.stringify(manifest, null, 2),
      },
    ],
  };
}
