import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '@runcontext/core';
import { formatError } from '../formatters/pretty.js';

export const serveCommand = new Command('serve')
  .description('Start the MCP server')
  .option('--transport <type>', 'Transport type: stdio or http', 'stdio')
  .option('--port <number>', 'Port for HTTP transport', '3000')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());

      const transport = opts.transport ?? config.mcp?.transport ?? 'stdio';
      const parsed = parseInt(opts.port, 10);
      const port = Number.isFinite(parsed) ? parsed : (config.mcp?.port ?? 3000);

      // Try to import the MCP server
      let startServer: ((config: unknown, options: { transport: string; port: number }) => Promise<void>) | undefined;
      try {
        const mcpModule = await import('@runcontext/mcp');
        startServer = mcpModule.startServer;
      } catch {
        // @runcontext/mcp not yet implemented
      }

      if (!startServer) {
        console.log(
          chalk.yellow(
            'MCP server is not yet available. Install @runcontext/mcp to enable this command.',
          ),
        );
        process.exit(0);
      }

      console.log(
        chalk.blue(
          `Starting MCP server (transport: ${transport}, port: ${port})...`,
        ),
      );
      await startServer(config, { transport, port });
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
