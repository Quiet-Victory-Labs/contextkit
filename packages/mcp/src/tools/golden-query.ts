import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Manifest, GoldenQuery } from '@runcontext/core';

export interface GoldenQueryMatch {
  model: string;
  query: GoldenQuery;
  score: number;
}

/**
 * Find golden queries matching a natural-language question.
 * Uses simple keyword overlap scoring.
 */
export function findGoldenQueries(manifest: Manifest, question: string): GoldenQueryMatch[] {
  const stopWords = new Set(['a', 'an', 'the', 'is', 'in', 'on', 'at', 'to', 'of', 'for', 'and', 'or', 'not']);
  const qWords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 0 && !stopWords.has(w));
  const matches: GoldenQueryMatch[] = [];

  for (const [modelName, rules] of Object.entries(manifest.rules)) {
    if (!rules.golden_queries) continue;

    for (const gq of rules.golden_queries) {
      const gqWords = gq.question.toLowerCase().split(/\s+/);
      const overlap = qWords.filter((w) => gqWords.some((gw) => gw.includes(w))).length;
      if (overlap > 0) {
        matches.push({
          model: modelName,
          query: gq,
          score: overlap / Math.max(qWords.length, 1),
        });
      }
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * Register the `context_golden_query` tool.
 * Finds golden queries matching a given question.
 */
export function registerGoldenQueryTool(server: McpServer, manifest: Manifest): void {
  server.tool(
    'context_golden_query',
    'Find golden SQL queries that match a natural-language question',
    { question: z.string().describe('Natural-language question to match against golden queries') },
    async ({ question }) => {
      const results = findGoldenQueries(manifest, question);
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
