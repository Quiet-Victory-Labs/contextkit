import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { loadConfig } from '@runcontext/core';

export const setupCommand = new Command('setup')
  .description('Build a data product for your semantic plane')
  .option('--port <port>', 'Port for setup UI', '4040')
  .option('--host <host>', 'Host to bind', '127.0.0.1')
  .option('--no-browser', "Don't open browser automatically")
  .action(async (opts) => {
    const rootDir = process.cwd();
    const config = loadConfig(rootDir);
    const contextDir = path.resolve(config.context_dir);
    const port = parseInt(opts.port, 10);

    console.log(chalk.cyan('ContextKit — AI-ready data starts here\n'));
    console.log(chalk.dim('Starting setup UI...'));

    const { startUIServer } = await import('@runcontext/ui');
    await startUIServer({
      rootDir,
      contextDir,
      port,
      host: opts.host,
    });

    const url = `http://localhost:${port}/setup`;
    console.log(chalk.green(`\n  Setup UI ready at ${url}\n`));

    if (opts.browser !== false) {
      const openCmd = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'start'
        : 'xdg-open';
      execFile(openCmd, [url], () => {});
    }
  });
