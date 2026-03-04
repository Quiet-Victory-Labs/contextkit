import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import {
  loadConfig,
  createAdapter,
  scaffoldFromSchema,
} from '@runcontext/core';
import type { DataSourceConfig } from '@runcontext/core';

export function parseDbUrl(db: string): DataSourceConfig {
  if (db.startsWith('duckdb://')) {
    return { adapter: 'duckdb', path: db.slice('duckdb://'.length) };
  }
  if (db.startsWith('postgres://') || db.startsWith('postgresql://')) {
    return { adapter: 'postgres', connection: db };
  }
  if (db.endsWith('.duckdb') || db.endsWith('.db')) {
    return { adapter: 'duckdb', path: db };
  }
  throw new Error(
    `Cannot determine adapter from "${db}". Use duckdb:// or postgres:// prefix.`,
  );
}

export const introspectCommand = new Command('introspect')
  .description('Introspect a database and scaffold Bronze-level OSI metadata')
  .option(
    '--db <url>',
    'Database URL (e.g., duckdb://path.duckdb or postgres://...)',
  )
  .option(
    '--source <name>',
    'Use a named data_source from contextkit.config.yaml',
  )
  .option('--tables <glob>', 'Filter tables by glob pattern (e.g., "vw_*")')
  .option(
    '--model-name <name>',
    'Name for the generated model (default: derived from source)',
  )
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = path.resolve(config.context_dir);

      // Resolve data source config
      let dsConfig: DataSourceConfig;
      let dsName: string;

      if (opts.db) {
        dsConfig = parseDbUrl(opts.db);
        dsName = opts.source ?? 'default';
      } else if (opts.source) {
        if (!config.data_sources?.[opts.source]) {
          console.error(
            chalk.red(
              `Data source "${opts.source}" not found in config`,
            ),
          );
          process.exit(1);
        }
        dsConfig = config.data_sources[opts.source];
        dsName = opts.source;
      } else {
        const sources = config.data_sources;
        if (!sources || Object.keys(sources).length === 0) {
          console.error(
            chalk.red(
              'No data source specified. Use --db <url> or configure data_sources in config',
            ),
          );
          process.exit(1);
        }
        const firstName = Object.keys(sources)[0]!;
        dsConfig = sources[firstName]!;
        dsName = firstName;
      }

      // Connect
      const adapter = await createAdapter(dsConfig);
      await adapter.connect();
      console.log(
        chalk.green(
          `Connected to ${dsConfig.adapter}: ${dsConfig.path ?? dsConfig.connection}`,
        ),
      );

      // Introspect
      let tables = await adapter.listTables();

      if (opts.tables) {
        const pattern = opts.tables.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        tables = tables.filter((t) => regex.test(t.name));
      }

      console.log(`Discovered ${tables.length} tables/views`);

      const columns: Record<string, any[]> = {};
      for (const table of tables) {
        columns[table.name] = await adapter.listColumns(table.name);
      }

      const totalCols = Object.values(columns).reduce(
        (sum, cols) => sum + cols.length,
        0,
      );
      console.log(`Found ${totalCols} columns total`);

      await adapter.disconnect();

      const modelName =
        opts.modelName ??
        dsName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

      const result = scaffoldFromSchema({
        modelName,
        dataSourceName: dsName,
        tables,
        columns,
      });

      // Write files
      for (const dir of ['models', 'governance', 'owners']) {
        const dirPath = path.join(contextDir, dir);
        if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
      }

      const osiPath = path.join(contextDir, 'models', result.files.osi);
      const govPath = path.join(
        contextDir,
        'governance',
        result.files.governance,
      );
      const ownerPath = path.join(contextDir, 'owners', result.files.owner);

      writeFileSync(osiPath, result.osiYaml, 'utf-8');
      writeFileSync(govPath, result.governanceYaml, 'utf-8');
      if (!existsSync(ownerPath)) {
        writeFileSync(ownerPath, result.ownerYaml, 'utf-8');
      }

      console.log('');
      console.log(chalk.green('Scaffolded:'));
      console.log(`  ${path.relative(process.cwd(), osiPath)}`);
      console.log(`  ${path.relative(process.cwd(), govPath)}`);
      console.log(`  ${path.relative(process.cwd(), ownerPath)}`);
      console.log('');
      console.log(chalk.cyan('Run `context tier` to check your tier score.'));
      console.log(
        chalk.cyan('Run `context verify` to validate against data.'),
      );
    } catch (err) {
      console.error(
        chalk.red(`Introspect failed: ${(err as Error).message}`),
      );
      process.exit(1);
    }
  });
