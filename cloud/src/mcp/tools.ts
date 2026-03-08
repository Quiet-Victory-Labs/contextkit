/**
 * MCP tool definitions and handlers for the cloud server.
 *
 * These mirror the local MCP tools (context_search, context_explain, etc.)
 * but read from in-memory cloud storage instead of a local manifest.
 */

import type { Storage } from '../storage.js';

/** MCP tool schema definition. */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** MCP content item. */
interface TextContent {
  type: 'text';
  text: string;
}

/** MCP tool call result. */
export interface ToolResult {
  content: TextContent[];
  isError?: boolean;
}

/** All cloud MCP tool definitions. */
export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'context_search',
    description:
      'Search across all ContextKit nodes (models, datasets, fields, terms, owners) by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword to search for' },
        product: {
          type: 'string',
          description: 'Optional data product name to scope search to',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'context_explain',
    description:
      'Deep lookup of a model with all related governance, rules, lineage, tier, owner, and glossary terms',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Name of the model to explain' },
      },
      required: ['model'],
    },
  },
  {
    name: 'context_golden_query',
    description:
      'Find golden SQL queries that match a natural-language question',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description:
            'Natural-language question to match against golden queries',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'context_guardrails',
    description:
      'Return guardrail filters that apply to the specified tables',
    inputSchema: {
      type: 'object',
      properties: {
        tables: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of table names to check guardrails for',
        },
      },
      required: ['tables'],
    },
  },
  {
    name: 'list_products',
    description:
      'List all data products in the semantic plane with their models',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_product',
    description:
      'Get full metadata for a specific data product including models, governance, rules, lineage, and tiers',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The data product name' },
      },
      required: ['name'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type ToolArgs = Record<string, unknown>;

/**
 * Dispatch a tool call to the appropriate handler.
 */
export function handleToolCall(
  toolName: string,
  args: ToolArgs,
  org: string,
  storage: Storage,
): ToolResult {
  switch (toolName) {
    case 'context_search':
      return handleSearch(org, args, storage);
    case 'context_explain':
      return handleExplain(org, args, storage);
    case 'context_golden_query':
      return handleGoldenQuery(org, args, storage);
    case 'context_guardrails':
      return handleGuardrails(org, args, storage);
    case 'list_products':
      return handleListProducts(org, storage);
    case 'get_product':
      return handleGetProduct(org, args, storage);
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
  }
}

// ---------------------------------------------------------------------------
// Individual tool handlers
// ---------------------------------------------------------------------------

function handleSearch(org: string, args: ToolArgs, storage: Storage): ToolResult {
  const query = String(args.query ?? '');
  const results = storage.search(org, query);
  return {
    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
  };
}

function handleExplain(org: string, args: ToolArgs, storage: Storage): ToolResult {
  const modelName = String(args.model ?? '');
  const plane = storage.getPlane(org);

  if (!plane) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `No data found for org: ${org}` }) }],
      isError: true,
    };
  }

  const manifest = plane.manifest;
  const models = manifest['models'] as Record<string, Record<string, unknown>> | undefined;
  const model = models?.[modelName];

  if (!model) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Model '${modelName}' not found` }) }],
    };
  }

  const governance = (manifest['governance'] as Record<string, unknown>)?.[modelName] ?? null;
  const rules = (manifest['rules'] as Record<string, unknown>)?.[modelName] ?? null;
  const lineage = (manifest['lineage'] as Record<string, unknown>)?.[modelName] ?? null;
  const tier = (manifest['tiers'] as Record<string, unknown>)?.[modelName] ?? null;

  const result = { model, governance, rules, lineage, tier };
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

function handleGoldenQuery(org: string, args: ToolArgs, storage: Storage): ToolResult {
  const question = String(args.question ?? '');
  const plane = storage.getPlane(org);

  if (!plane) {
    return {
      content: [{ type: 'text', text: '[]' }],
    };
  }

  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'in', 'on', 'at', 'to', 'of', 'for', 'and', 'or', 'not',
  ]);
  const qWords = question
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopWords.has(w));

  const matches: Array<{ model: string; query: unknown; score: number }> = [];
  const rules = plane.manifest['rules'] as Record<string, Record<string, unknown>> | undefined;

  if (rules) {
    for (const [modelName, modelRules] of Object.entries(rules)) {
      const goldenQueries = modelRules['golden_queries'] as
        | Array<{ question: string; sql: string }>
        | undefined;
      if (!goldenQueries) continue;

      for (const gq of goldenQueries) {
        const gqWords = gq.question.toLowerCase().split(/\s+/);
        const overlap = qWords.filter((w) =>
          gqWords.some((gw) => gw.includes(w)),
        ).length;
        if (overlap > 0) {
          matches.push({
            model: modelName,
            query: gq,
            score: overlap / Math.max(qWords.length, 1),
          });
        }
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return {
    content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }],
  };
}

function handleGuardrails(org: string, args: ToolArgs, storage: Storage): ToolResult {
  const tables = (args.tables ?? []) as string[];
  const plane = storage.getPlane(org);

  if (!plane) {
    return {
      content: [{ type: 'text', text: '[]' }],
    };
  }

  const tableSet = new Set(tables.map((t) => t.toLowerCase()));
  const matches: Array<{ model: string; filter: unknown }> = [];
  const rules = plane.manifest['rules'] as Record<string, Record<string, unknown>> | undefined;

  if (rules) {
    for (const [modelName, modelRules] of Object.entries(rules)) {
      const guardrailFilters = modelRules['guardrail_filters'] as
        | Array<{ tables?: string[]; condition: string; reason: string }>
        | undefined;
      if (!guardrailFilters) continue;

      for (const gf of guardrailFilters) {
        const applies =
          !gf.tables ||
          gf.tables.length === 0 ||
          gf.tables.some((t) => tableSet.has(t.toLowerCase()));

        if (applies) {
          matches.push({ model: modelName, filter: gf });
        }
      }
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }],
  };
}

function handleListProducts(org: string, storage: Storage): ToolResult {
  const productNames = storage.getProducts(org);

  if (productNames.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'No data products found. This is a single-product semantic plane.',
        },
      ],
    };
  }

  // Build summaries with model counts
  const plane = storage.getPlane(org)!;
  const products = (plane.manifest['products'] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const summaries = productNames.map((name) => {
    const p = products[name] as { models?: Record<string, unknown> } | undefined;
    const models = p?.models ? Object.keys(p.models) : [];
    return { name, modelCount: models.length, models };
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(summaries, null, 2) }],
  };
}

function handleGetProduct(org: string, args: ToolArgs, storage: Storage): ToolResult {
  const name = String(args.name ?? '');
  const product = storage.getProduct(org, name);

  if (!product) {
    return {
      content: [{ type: 'text', text: `Data product "${name}" not found.` }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ name, ...product }, null, 2) }],
  };
}
