import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import type { Manifest, ContextGraph, ContextKitConfig } from '@runcontext/core';
import { compile, emitManifest, loadConfig } from '@runcontext/core';

import { registerManifestResource } from './resources/manifest.js';
import { registerModelResource } from './resources/model.js';
import { registerGlossaryResource } from './resources/glossary.js';
import { registerTierResource } from './resources/tier.js';
import { registerDataProductResource } from './resources/data-product.js';

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

  // Register resources (5)
  registerManifestResource(server, manifest);
  registerModelResource(server, manifest);
  registerGlossaryResource(server, manifest);
  registerTierResource(server, manifest);
  registerDataProductResource(server, manifest);

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

/**
 * Compile context, create server, and serve over HTTP.
 *
 * Each request gets a fresh McpServer + transport (stateless mode).
 * The graph is compiled once at startup and reused for all requests.
 */
export async function startServerHttp(options?: {
  contextDir?: string;
  rootDir?: string;
  port?: number;
  host?: string;
}): Promise<void> {
  const rootDir = options?.rootDir ?? process.cwd();
  const config = loadConfig(rootDir);
  const contextDir = options?.contextDir ?? config.context_dir;

  const { graph } = await compile({ contextDir, config });
  const manifest = emitManifest(graph, config);

  const host = options?.host ?? '0.0.0.0';
  const app = createMcpExpressApp({ host });

  // Stateless: new server + transport per POST (per MCP SDK pattern)
  app.post('/mcp', async (req, res) => {
    try {
      const server = createServer(manifest, graph);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // GET /mcp and DELETE /mcp are not supported in stateless mode
  app.get('/mcp', (_req, res) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    }));
  });

  app.delete('/mcp', (_req, res) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    }));
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', models: [...graph.models.keys()] });
  });

  const port = options?.port ?? 3000;
  app.listen(port, host, () => {
    console.error(`ContextKit MCP server listening on http://${host}:${port}/mcp`);
    console.error(`Health check: http://${host}:${port}/health`);
  });
}
