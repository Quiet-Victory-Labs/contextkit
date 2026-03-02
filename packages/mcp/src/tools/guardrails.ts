import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Manifest, GuardrailFilter } from '@runcontext/core';

export interface GuardrailMatch {
  model: string;
  filter: GuardrailFilter;
}

/**
 * Find guardrail filters that apply to the given tables.
 */
export function findGuardrails(manifest: Manifest, tables: string[]): GuardrailMatch[] {
  const matches: GuardrailMatch[] = [];
  const tableSet = new Set(tables.map((t) => t.toLowerCase()));

  for (const [modelName, rules] of Object.entries(manifest.rules)) {
    if (!rules.guardrail_filters) continue;

    for (const gf of rules.guardrail_filters) {
      // A guardrail matches if:
      // 1. It has no tables restriction (applies globally), or
      // 2. Any of its tables match the requested tables
      const applies =
        !gf.tables ||
        gf.tables.length === 0 ||
        gf.tables.some((t) => tableSet.has(t.toLowerCase()));

      if (applies) {
        matches.push({
          model: modelName,
          filter: gf,
        });
      }
    }
  }

  return matches;
}

/**
 * Register the `context_guardrails` tool.
 * Returns guardrail filters for given tables.
 */
export function registerGuardrailsTool(server: McpServer, manifest: Manifest): void {
  server.tool(
    'context_guardrails',
    'Return guardrail filters that apply to the specified tables',
    {
      tables: z.array(z.string()).describe('List of table names to check guardrails for'),
    },
    async ({ tables }) => {
      const results = findGuardrails(manifest, tables);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}
