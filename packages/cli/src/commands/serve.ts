import { Command } from 'commander';
import chalk from 'chalk';
import { formatError } from '../formatters/pretty.js';
import { brand } from '../brand.js';

export const serveCommand = new Command('serve')
  .description('Start the MCP server (stdio or HTTP transport)')
  .option('--context-dir <path>', 'Path to context directory')
  .option('--http', 'Serve over HTTP instead of stdio')
  .option('--port <number>', 'HTTP port (default: 3000)', '3000')
  .option('--host <address>', 'HTTP host (default: 0.0.0.0)', '0.0.0.0')
  .action(async (opts) => {
    try {
      // Dynamic import — @runcontext/mcp is an optional peer
      let mcpModule: Record<string, unknown> | undefined;
      try {
        mcpModule = await import('@runcontext/mcp');
      } catch {
        // @runcontext/mcp not installed
      }

      if (!mcpModule) {
        console.log(
          chalk.yellow(
            'MCP server is not available. Install @runcontext/mcp to enable this command.',
          ),
        );
        process.exit(1);
      }

      if (opts.http) {
        const startServerHttp = mcpModule.startServerHttp as (options?: {
          contextDir?: string;
          rootDir?: string;
          port?: number;
          host?: string;
        }) => Promise<void>;

        const port = parseInt(opts.port, 10);
        console.log(chalk.blue(`${brand.mcpServing} (HTTP on port ${port})`));
        await startServerHttp({
          contextDir: opts.contextDir,
          rootDir: process.cwd(),
          port,
          host: opts.host,
        });
      } else {
        const startServer = mcpModule.startServer as (options?: {
          contextDir?: string;
          rootDir?: string;
        }) => Promise<unknown>;

        console.log(chalk.blue(`${brand.mcpServing} (stdio transport)`));
        await startServer({
          contextDir: opts.contextDir,
          rootDir: process.cwd(),
        });
      }
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
