import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import * as yaml from 'yaml';
import { loadConfig } from '@runcontext/core';
import { formatSuccess, formatError } from '../formatters/pretty.js';

const STARTER_OSI = (name: string, dataSource?: string) => {
  const doc: Record<string, unknown> = {
    version: '1.0',
    semantic_model: [
      {
        name,
        description: `Data product: ${name}`,
        ...(dataSource ? { data_source: dataSource } : {}),
        datasets: [],
      },
    ],
  };
  return yaml.stringify(doc, { lineWidth: 120 });
};

const STARTER_GOVERNANCE = (name: string) => {
  const doc = {
    model: name,
    owner: 'default-team',
    security: 'internal',
    datasets: {},
  };
  return yaml.stringify(doc, { lineWidth: 120 });
};

const STARTER_RULES = (name: string) => {
  const doc = {
    model: name,
    business_rules: [],
    guardrail_filters: [],
    golden_queries: [],
  };
  return yaml.stringify(doc, { lineWidth: 120 });
};

const STARTER_OWNER = () => {
  const doc = {
    id: 'default-team',
    display_name: 'Default Team',
  };
  return yaml.stringify(doc, { lineWidth: 120 });
};

export const newCommand = new Command('new')
  .description('Scaffold a new data product inside your context directory')
  .argument('<name>', 'Name for the data product (e.g. sales-analytics)')
  .option('--source <name>', 'Bind to a named data source from runcontext.config.yaml')
  .option('--context-dir <path>', 'Path to context directory')
  .action(async (name: string, opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);

      // Validate data source exists if specified
      if (opts.source && config.data_sources) {
        const sources = config.data_sources as Record<string, unknown>;
        if (!sources[opts.source]) {
          const available = Object.keys(sources).join(', ');
          console.error(formatError(
            `Data source "${opts.source}" not found in runcontext.config.yaml. Available: ${available || '(none)'}`,
          ));
          process.exit(1);
        }
      }

      // Create data product directories
      const dirs = [
        path.join(contextDir, 'models'),
        path.join(contextDir, 'governance'),
        path.join(contextDir, 'owners'),
        path.join(contextDir, 'reference'),
      ];

      for (const dir of dirs) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      }

      // Write starter files (skip if they already exist)
      const files = [
        {
          rel: path.join('models', `${name}.osi.yaml`),
          content: STARTER_OSI(name, opts.source),
        },
        {
          rel: path.join('governance', `${name}.governance.yaml`),
          content: STARTER_GOVERNANCE(name),
        },
        {
          rel: path.join('governance', `${name}.rules.yaml`),
          content: STARTER_RULES(name),
        },
        {
          rel: path.join('owners', 'default-team.owner.yaml'),
          content: STARTER_OWNER(),
        },
      ];

      const created: string[] = [];
      const skipped: string[] = [];

      for (const f of files) {
        const fullPath = path.join(contextDir, f.rel);
        if (fs.existsSync(fullPath)) {
          skipped.push(f.rel);
        } else {
          fs.writeFileSync(fullPath, f.content, 'utf-8');
          created.push(f.rel);
        }
      }

      // Summary
      console.log('');
      if (created.length > 0) {
        console.log(formatSuccess(`Data product "${name}" scaffolded`));
        console.log('');
        for (const f of created) {
          console.log(chalk.green(`  + ${f}`));
        }
      }
      if (skipped.length > 0) {
        for (const f of skipped) {
          console.log(chalk.gray(`  ~ ${f} (exists)`));
        }
      }

      console.log('');
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray(`  1. Run ${chalk.cyan(`context introspect --db <url>`)} to populate from a database`));
      console.log(chalk.gray(`  2. Run ${chalk.cyan(`context enrich --target silver --apply`)} to auto-fill descriptions`));
      console.log(chalk.gray(`  3. Run ${chalk.cyan(`context tier`)} to check progress toward Gold`));
      console.log(chalk.gray(`  4. Run ${chalk.cyan(`context blueprint ${name}`)} to export the AI Blueprint`));
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
