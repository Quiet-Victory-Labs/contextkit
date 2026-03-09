import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Manifest } from '@runcontext/core';

/**
 * Register the `context://manifest` resource.
 * Returns the full compiled manifest as JSON.
 */
export function registerManifestResource(server: McpServer, manifest: Manifest): void {
  server.resource(
    'manifest',
    'context://manifest',
    { description: 'Full RunContext manifest JSON (models, governance, rules, lineage, terms, owners, tiers)' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(manifest, null, 2),
        },
      ],
    }),
  );
}
