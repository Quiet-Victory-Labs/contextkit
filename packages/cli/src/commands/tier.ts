import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { compile, loadConfig, computeTier, type TierScore } from '@runcontext/core';
import { formatTierScore, formatError } from '../formatters/pretty.js';
import { formatJson } from '../formatters/json.js';

export const tierCommand = new Command('tier')
  .description('Show tier scorecard for one or all models')
  .argument('[model-name]', 'Specific model name to check')
  .option('--context-dir <path>', 'Path to context directory')
  .option('--format <type>', 'Output format: pretty or json', 'pretty')
  .action(async (modelName: string | undefined, opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);

      const { graph } = await compile({ contextDir, config });

      let scores: TierScore[];

      if (modelName) {
        // Single model
        if (!graph.models.has(modelName)) {
          console.error(formatError(`Model '${modelName}' not found.`));
          const available = [...graph.models.keys()].join(', ');
          if (available) {
            console.error(chalk.gray(`Available models: ${available}`));
          }
          process.exit(1);
        }
        scores = [computeTier(modelName, graph)];
      } else {
        // All models
        scores = [...graph.models.keys()].map((name) =>
          computeTier(name, graph),
        );
      }

      if (scores.length === 0) {
        console.log(
          opts.format === 'json'
            ? formatJson([])
            : chalk.yellow('No models found.'),
        );
        return;
      }

      if (opts.format === 'json') {
        console.log(formatJson(scores));
      } else {
        for (const score of scores) {
          console.log(formatTierScore(score));
          console.log('');
        }
      }
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
