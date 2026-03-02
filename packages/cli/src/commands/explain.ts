import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { compile, loadConfig } from '@runcontext/core';
import { formatJson } from '../formatters/json.js';
import { formatError } from '../formatters/pretty.js';

export const explainCommand = new Command('explain')
  .description('Look up models, terms, or owners by name and show details')
  .argument('<name>', 'Name of a model, term, or owner to look up')
  .option('--context-dir <path>', 'Path to context directory')
  .option('--format <type>', 'Output format: pretty or json', 'pretty')
  .action(async (name: string, opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);

      const { graph } = await compile({ contextDir, config });

      const results: Array<{ type: string; name: string; data: unknown }> = [];

      // Search models
      if (graph.models.has(name)) {
        results.push({ type: 'model', name, data: graph.models.get(name) });
      }

      // Search terms
      if (graph.terms.has(name)) {
        results.push({ type: 'term', name, data: graph.terms.get(name) });
      }

      // Search owners
      if (graph.owners.has(name)) {
        results.push({ type: 'owner', name, data: graph.owners.get(name) });
      }

      // Search governance
      if (graph.governance.has(name)) {
        results.push({
          type: 'governance',
          name,
          data: graph.governance.get(name),
        });
      }

      // Search rules
      if (graph.rules.has(name)) {
        results.push({ type: 'rules', name, data: graph.rules.get(name) });
      }

      // Search lineage
      if (graph.lineage.has(name)) {
        results.push({ type: 'lineage', name, data: graph.lineage.get(name) });
      }

      if (results.length === 0) {
        console.error(formatError(`No matching entity found for '${name}'.`));
        process.exit(1);
      }

      if (opts.format === 'json') {
        console.log(formatJson(results));
      } else {
        for (const result of results) {
          console.log(chalk.bold(`${result.type}: ${result.name}`));
          console.log(chalk.gray('---'));
          console.log(JSON.stringify(result.data, null, 2));
          console.log('');
        }
      }
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
