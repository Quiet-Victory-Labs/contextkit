import { Command } from 'commander';
import chalk from 'chalk';
import { formatError } from '../formatters/pretty.js';

export const serveCommand = new Command('serve')
  .description('Start the MCP server (stdio transport)')
  .option('--context-dir <path>', 'Path to context directory')
  .action(async (opts) => {
    try {
      // Dynamic import — @runcontext/mcp is an optional peer
      let startServer: ((options?: { contextDir?: string; rootDir?: string }) => Promise<unknown>) | undefined;
      try {
        const mcpModule = await import('@runcontext/mcp');
        startServer = mcpModule.startServer;
      } catch {
        // @runcontext/mcp not installed
      }

      if (!startServer) {
        console.log(
          chalk.yellow(
            'MCP server is not available. Install @runcontext/mcp to enable this command.',
          ),
        );
        process.exit(1);
      }

      console.log(chalk.blue('Starting MCP server (stdio transport)...'));
      await startServer({
        contextDir: opts.contextDir,
        rootDir: process.cwd(),
      });
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
