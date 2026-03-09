import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import { compile, loadConfig, emitManifest } from '@runcontext/core';
import { formatJson } from '../formatters/json.js';
import { formatSuccess, formatError } from '../formatters/pretty.js';
import { brand } from '../brand.js';

export const buildCommand = new Command('build')
  .description('Compile context files and emit manifest JSON')
  .option('--context-dir <path>', 'Path to context directory')
  .option('--output-dir <path>', 'Path to output directory')
  .option('--format <type>', 'Output format: pretty or json', 'pretty')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);
      const outputDir = opts.outputDir
        ? path.resolve(opts.outputDir)
        : path.resolve(config.output_dir);

      // Compile the context graph
      const { graph, diagnostics } = await compile({ contextDir, config, rootDir: process.cwd() });

      // Check for compile errors
      const errors = diagnostics.filter((d) => d.severity === 'error');
      if (errors.length > 0) {
        if (opts.format === 'json') {
          console.log(formatJson({ success: false, errors }));
        } else {
          console.error(
            chalk.red(`Build failed with ${errors.length} error(s):`),
          );
          for (const e of errors) {
            console.error(chalk.red(`  - ${e.message} [${e.ruleId}]`));
          }
        }
        process.exit(1);
      }

      // Emit manifest
      const manifest = emitManifest(graph, config);

      // Write to output directory
      fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, 'runcontext-manifest.json');
      fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');

      const productCount = graph.models.size;

      if (opts.format === 'json') {
        console.log(formatJson({ success: true, outputPath, manifest }));
      } else {
        console.log(formatSuccess(brand.buildSuccess(productCount)));
        console.log(chalk.dim(`  Manifest written to ${outputPath}`));
      }
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
