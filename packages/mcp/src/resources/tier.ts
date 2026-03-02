import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Manifest } from '@runcontext/core';

/**
 * Register the `context://tier/{name}` resource template.
 * Returns the tier scorecard for a specific model.
 */
export function registerTierResource(server: McpServer, manifest: Manifest): void {
  server.resource(
    'tier',
    new ResourceTemplate('context://tier/{name}', {
      list: async () => ({
        resources: Object.keys(manifest.tiers).map((name) => ({
          uri: `context://tier/${name}`,
          name,
          description: `Tier scorecard for model: ${name} (${manifest.tiers[name]?.tier ?? 'unknown'})`,
        })),
      }),
    }),
    { description: 'Tier scorecard for a model (bronze/silver/gold checks and results)' },
    async (uri, { name }) => {
      const modelName = String(name);
      const tier = manifest.tiers[modelName];
      if (!tier) {
        throw new Error(`Tier data for model '${modelName}' not found`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(tier, null, 2),
          },
        ],
      };
    },
  );
}
