import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Manifest, ContextGraph, ContextKitConfig } from '@runcontext/core';
import { compile, emitManifest, loadConfig } from '@runcontext/core';

import { registerManifestResource } from './resources/manifest.js';
import { registerModelResource } from './resources/model.js';
import { registerGlossaryResource } from './resources/glossary.js';
import { registerTierResource } from './resources/tier.js';

import { registerSearchTool } from './tools/search.js';
import { registerExplainTool } from './tools/explain.js';
import { registerValidateTool } from './tools/validate.js';
import { registerTierTool } from './tools/tier.js';
import { registerGoldenQueryTool } from './tools/golden-query.js';
import { registerGuardrailsTool } from './tools/guardrails.js';

/**
 * Create and configure an MCP server with all ContextKit resources and tools.
 *
 * Use this for testing or embedding — no transport is connected.
 */
export function createServer(manifest: Manifest, graph: ContextGraph): McpServer {
  const server = new McpServer({
    name: 'contextkit',
    version: '0.2.0',
  });

  // Register resources (4)
  registerManifestResource(server, manifest);
  registerModelResource(server, manifest);
  registerGlossaryResource(server, manifest);
  registerTierResource(server, manifest);

  // Register tools (6)
  registerSearchTool(server, manifest);
  registerExplainTool(server, manifest);
  registerValidateTool(server, graph);
  registerTierTool(server, graph);
  registerGoldenQueryTool(server, manifest);
  registerGuardrailsTool(server, manifest);

  return server;
}

/**
 * Compile context, create server, and connect stdio transport.
 *
 * This is the main entry point for running the MCP server as a process.
 */
export async function startServer(options?: {
  contextDir?: string;
  rootDir?: string;
}): Promise<McpServer> {
  const rootDir = options?.rootDir ?? process.cwd();
  const config = loadConfig(rootDir);
  const contextDir = options?.contextDir ?? config.context_dir;

  const { graph } = await compile({ contextDir, config });
  const manifest = emitManifest(graph, config);
  const server = createServer(manifest, graph);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  return server;
}
