import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { loadConfig } from '@runcontext/core';
import { brand } from '../brand.js';

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

    console.log(chalk.cyan(`${brand.banner}\n`));
    console.log(chalk.dim('Starting setup UI...'));

    const { startUIServer } = await import('@runcontext/ui');
    await startUIServer({
      rootDir,
      contextDir,
      port,
      host: opts.host,
    });

    const displayHost = (opts.host === '0.0.0.0' || opts.host === '::') ? '127.0.0.1' : opts.host;
    const url = `http://${displayHost}:${port}/setup`;
    console.log(chalk.green(`\n  Setup UI ready at ${url}\n`));

    if (opts.browser !== false) {
      if (process.platform === 'darwin') {
        execFile('open', [url], () => {});
      } else if (process.platform === 'win32') {
        execFile('cmd.exe', ['/c', 'start', '', url], () => {});
      } else {
        execFile('xdg-open', [url], () => {});
      }
    }
  });
