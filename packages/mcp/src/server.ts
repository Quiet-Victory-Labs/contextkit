import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Manifest } from '@contextkit/core';

import { readManifest } from './resources/manifest.js';
import { readConcept, listConcepts } from './resources/concept.js';
import { readProduct, listProducts } from './resources/product.js';
import { readPolicy, listPolicies } from './resources/policy.js';
import { readGlossary } from './resources/glossary.js';
import { searchContext } from './tools/search.js';
import { explainNode } from './tools/explain.js';
import { validateContext } from './tools/validate.js';

/**
 * Creates an MCP server wired up with all ContextKit resources and tools.
 */
export function createContextMcpServer(manifest: Manifest): McpServer {
  const server = new McpServer(
    {
      name: 'contextkit',
      version: '0.1.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  // ── Static Resources ──────────────────────────────────────────────

  // context://manifest — full manifest
  server.resource(
    'manifest',
    'context://manifest',
    { description: 'The full ContextKit manifest', mimeType: 'application/json' },
    () => readManifest(manifest),
  );

  // context://glossary — all terms
  server.resource(
    'glossary',
    'context://glossary',
    { description: 'Glossary of all terms', mimeType: 'application/json' },
    () => readGlossary(manifest),
  );

  // ── Template Resources ────────────────────────────────────────────

  // context://concept/{id}
  server.resource(
    'concept',
    new ResourceTemplate('context://concept/{id}', {
      list: () => listConcepts(manifest),
    }),
    { description: 'A single concept by ID', mimeType: 'application/json' },
    (uri, variables) => readConcept(manifest, String(variables.id)),
  );

  // context://product/{id}
  server.resource(
    'product',
    new ResourceTemplate('context://product/{id}', {
      list: () => listProducts(manifest),
    }),
    { description: 'A single product by ID', mimeType: 'application/json' },
    (uri, variables) => readProduct(manifest, String(variables.id)),
  );

  // context://policy/{id}
  server.resource(
    'policy',
    new ResourceTemplate('context://policy/{id}', {
      list: () => listPolicies(manifest),
    }),
    { description: 'A single policy by ID', mimeType: 'application/json' },
    (uri, variables) => readPolicy(manifest, String(variables.id)),
  );

  // ── Tools ─────────────────────────────────────────────────────────

  // context_search — search across all nodes
  server.tool(
    'context_search',
    'Search across all concepts, products, policies, entities, and terms',
    { query: z.string().describe('The search query (case-insensitive substring match)') },
    ({ query }) => searchContext(manifest, query),
  );

  // context_explain — explain a node by ID
  server.tool(
    'context_explain',
    'Get comprehensive info about a node: the node itself, dependencies, dependents, applicable policies, and owner',
    { id: z.string().describe('The ID of the node to explain') },
    ({ id }) => explainNode(manifest, id),
  );

  // context_validate — run compile + lint
  server.tool(
    'context_validate',
    'Run compile and lint validation on the context directory and return diagnostics',
    { rootDir: z.string().optional().describe('Root directory to validate (defaults to cwd)') },
    async ({ rootDir }) => validateContext(rootDir),
  );

  return server;
}
