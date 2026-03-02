import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Manifest } from '@runcontext/core';

/**
 * Build a merged view of a model: OSI model + governance + rules + lineage + tier.
 */
export function buildModelView(name: string, manifest: Manifest): Record<string, unknown> | null {
  const model = manifest.models[name];
  if (!model) return null;

  return {
    model,
    governance: manifest.governance[name] ?? null,
    rules: manifest.rules[name] ?? null,
    lineage: manifest.lineage[name] ?? null,
    tier: manifest.tiers[name] ?? null,
  };
}

/**
 * Register the `context://model/{name}` resource template.
 * Returns the OSI model merged with governance, rules, lineage, and tier data.
 */
export function registerModelResource(server: McpServer, manifest: Manifest): void {
  server.resource(
    'model',
    new ResourceTemplate('context://model/{name}', {
      list: async () => ({
        resources: Object.keys(manifest.models).map((name) => ({
          uri: `context://model/${name}`,
          name,
          description: manifest.models[name]?.description ?? `Model: ${name}`,
        })),
      }),
    }),
    { description: 'OSI semantic model merged with governance, rules, lineage, and tier' },
    async (uri, { name }) => {
      const modelName = String(name);
      const view = buildModelView(modelName, manifest);
      if (!view) {
        throw new Error(`Model '${modelName}' not found`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(view, null, 2),
          },
        ],
      };
    },
  );
}
