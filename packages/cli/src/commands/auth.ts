import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'node:readline';
import {
  createDefaultRegistry,
  CredentialStore,
} from '@runcontext/core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';

export const authCommand = new Command('auth')
  .description('Authenticate with a cloud database provider')
  .argument('[provider]', 'Provider name (e.g. neon, aws-rds, gcp, azure-sql)')
  .option('--list', 'List all supported providers')
  .action(async (providerArg, opts) => {
    const registry = createDefaultRegistry();

    if (opts.list) {
      console.log(chalk.bold('Supported providers:'));
      for (const p of registry.getAll()) {
        console.log(`  ${chalk.cyan(p.id)} — ${p.displayName} (${p.adapters.join(', ')})`);
      }
      return;
    }

    // Select provider
    let providerId = providerArg;
    if (!providerId) {
      const providers = registry.getAll();
      console.log(chalk.bold('Select a database provider:\n'));
      providers.forEach((p, i) => {
        console.log(`  ${chalk.cyan(String(i + 1))}. ${p.displayName} (${p.adapters.join(', ')})`);
      });
      console.log('');

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((resolve) => {
        rl.question('  Enter number: ', (a) => { rl.close(); resolve(a); });
      });

      const idx = parseInt(answer, 10) - 1;
      if (idx < 0 || idx >= providers.length) {
        console.error(chalk.red('Invalid selection'));
        process.exit(1);
      }
      providerId = providers[idx]!.id;
    }

    const provider = registry.get(providerId);
    if (!provider) {
      console.error(chalk.red(`Unknown provider: ${providerId}`));
      console.log(`Run ${chalk.cyan('context auth --list')} to see supported providers.`);
      process.exit(1);
    }

    // Detect CLI
    console.log(`\n  Checking for ${provider.displayName} CLI...`);
    const cli = await provider.detectCli();
    if (cli.installed && cli.authenticated) {
      console.log(chalk.green(`  Found existing ${provider.displayName} credentials.`));
    } else if (cli.installed) {
      console.log(chalk.yellow(`  ${provider.displayName} CLI found but not authenticated.`));
    } else {
      console.log(chalk.dim(`  ${provider.displayName} CLI not found. Using browser OAuth.`));
    }

    // Authenticate
    console.log(`\n  Authenticating with ${provider.displayName}...`);
    const authResult = await provider.authenticate();
    if (!authResult.ok) {
      console.error(chalk.red(`  Authentication failed: ${authResult.error}`));
      process.exit(1);
    }
    console.log(chalk.green('  Authenticated.'));

    // List databases
    console.log(`\n  Fetching databases...`);
    const databases = await provider.listDatabases();

    let selectedDb;
    if (databases.length > 0) {
      console.log(chalk.bold(`\n  Available databases:\n`));
      databases.forEach((db, i) => {
        console.log(`    ${chalk.cyan(String(i + 1))}. ${db.name} (${db.host ?? db.id})`);
      });
      console.log(`    ${chalk.dim(`${databases.length + 1}. Enter manually`)}`);
      console.log('');

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((resolve) => {
        rl.question('  Select database: ', (a) => { rl.close(); resolve(a); });
      });

      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < databases.length) {
        selectedDb = databases[idx];
      }
    }

    if (!selectedDb) {
      // Manual entry
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const host = await new Promise<string>((resolve) => {
        rl.question('  Database host: ', resolve);
      });
      const name = await new Promise<string>((resolve) => {
        rl.question('  Database name: ', resolve);
      });
      rl.close();

      selectedDb = {
        id: host,
        name,
        host,
        adapter: provider.adapters[0]!,
        metadata: {},
      };
    }

    // Inject token into metadata for connection string building
    (selectedDb as any).metadata = { ...(selectedDb as any).metadata, token: authResult.token };

    // Test connection
    console.log(`\n  Testing connection...`);
    const connStr = await provider.getConnectionString(selectedDb as any);
    try {
      const { createAdapter } = await import('@runcontext/core');
      const adapter = await createAdapter({
        adapter: selectedDb.adapter!,
        connection: connStr,
      });
      await adapter.connect();
      await adapter.query('SELECT 1');
      await adapter.disconnect();
      console.log(chalk.green('  Connection successful!'));
    } catch (err) {
      console.error(chalk.red(`  Connection failed: ${(err as Error).message}`));
      process.exit(1);
    }

    // Save credential
    const credKey = `${provider.id}:${selectedDb.id}`;
    const store = new CredentialStore();
    await store.save({
      provider: provider.id,
      key: credKey,
      token: authResult.token,
      refreshToken: authResult.ok ? authResult.refreshToken : undefined,
      expiresAt: authResult.ok ? authResult.expiresAt : undefined,
      metadata: {
        host: selectedDb.host,
        database: selectedDb.name,
        ...selectedDb.metadata,
        token: undefined, // Don't persist the raw token in metadata
      },
    });
    console.log(chalk.green(`  Credentials saved as ${chalk.cyan(credKey)}`));

    // Update config
    const configPath = path.join(process.cwd(), 'runcontext.config.yaml');
    let config: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
      try {
        config = yaml.parse(fs.readFileSync(configPath, 'utf-8')) ?? {};
      } catch { /* start fresh */ }
    }

    config.data_sources = config.data_sources ?? {};
    config.data_sources.default = {
      adapter: selectedDb.adapter,
      auth: credKey,
    };

    fs.writeFileSync(configPath, yaml.stringify(config), 'utf-8');
    console.log(chalk.green(`\n  Config updated: data_sources.default.auth = ${credKey}`));
    console.log(chalk.dim(`  Connection string will be resolved at runtime from stored credentials.\n`));
  });
