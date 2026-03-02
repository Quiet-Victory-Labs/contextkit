import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { compile, loadConfig, emitManifest } from '@runcontext/core';
import { formatError } from '../formatters/pretty.js';

export const siteCommand = new Command('site')
  .description('Build a static documentation site from compiled context')
  .option('--context-dir <path>', 'Path to context directory')
  .option('--output-dir <path>', 'Path to site output directory')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);

      // Compile the context graph
      const { graph } = await compile({ contextDir, config });
      const manifest = emitManifest(graph, config);

      // Try to import the site generator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import
      let buildSite: ((...args: any[]) => Promise<void>) | undefined;
      try {
        const siteModule = await import('@runcontext/site');
        buildSite = siteModule.buildSite;
      } catch {
        // @runcontext/site not yet implemented
      }

      if (!buildSite) {
        console.log(
          chalk.yellow(
            'Site generator is not yet available. Install @runcontext/site to enable this command.',
          ),
        );
        process.exit(0);
      }

      const outputDir = opts.outputDir
        ? path.resolve(opts.outputDir)
        : path.resolve(config.site?.base_path ?? 'site');

      await buildSite(manifest, config, outputDir);
      console.log(chalk.green(`Site built to ${outputDir}`));
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
