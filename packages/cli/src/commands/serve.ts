import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import type { Manifest } from '@contextkit/core';

export const serveCommand = new Command('serve')
  .description('Start the MCP server')
  .option('--stdio', 'Use stdio transport (default)')
  .option('--http <port>', 'Use HTTP/SSE transport on the given port', parseInt)
  .option('--manifest <path>', 'Path to manifest file', 'dist/context.manifest.json')
  .action(async (opts: { stdio?: boolean; http?: number; manifest: string }) => {
    try {
      // Resolve manifest path
      const manifestPath = path.resolve(process.cwd(), opts.manifest);
      if (!fs.existsSync(manifestPath)) {
        console.error(`Manifest not found: ${manifestPath}`);
        console.error('Run "context build" first to generate the manifest.');
        process.exit(1);
      }

      const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;

      // Dynamic import to avoid loading MCP deps when not needed
      const { createContextMcpServer } = await import('@contextkit/mcp');

      const server = createContextMcpServer(manifestData);

      if (opts.http) {
        // HTTP/SSE transport via express + StreamableHTTPServerTransport
        const { StreamableHTTPServerTransport } = await import(
          '@modelcontextprotocol/sdk/server/streamableHttp.js'
        );
        const { createMcpExpressApp } = await import(
          '@modelcontextprotocol/sdk/server/express.js'
        );
        const { randomUUID } = await import('node:crypto');

        const app = createMcpExpressApp();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        app.all('/mcp', (req, res) => {
          transport.handleRequest(req, res);
        });

        await server.connect(transport);

        const port = opts.http;
        app.listen(port, () => {
          console.log(`ContextKit MCP server listening on http://127.0.0.1:${port}/mcp`);
        });
      } else {
        // Default: stdio transport
        const { StdioServerTransport } = await import(
          '@modelcontextprotocol/sdk/server/stdio.js'
        );

        const transport = new StdioServerTransport();
        await server.connect(transport);

        // In stdio mode, log to stderr so stdout stays clean for MCP protocol
        console.error('ContextKit MCP server running on stdio');
      }
    } catch (err) {
      console.error('Failed to start MCP server:', (err as Error).message);
      process.exit(1);
    }
  });
