import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Manifest } from '@runcontext/core';

/**
 * Register the `context://glossary` resource.
 * Returns all glossary terms as JSON.
 */
export function registerGlossaryResource(server: McpServer, manifest: Manifest): void {
  server.resource(
    'glossary',
    'context://glossary',
    { description: 'All RunContext glossary terms with definitions, synonyms, and mappings' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(manifest.terms, null, 2),
        },
      ],
    }),
  );
}
