import * as p from '@clack/prompts';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as yaml from 'yaml';
import { loadConfig, createAdapter, MissingDriverError } from '@runcontext/core';
import type { ColumnInfo, DataSourceConfig } from '@runcontext/core';
import { parseDbUrl } from '../../commands/introspect.js';
import { discoverDatabases, toDataSourceConfig } from '../mcp-discovery.js';
import type { SetupContext, TargetTier, UserIntent } from '../types.js';

interface DetectedDb {
  dsConfig: DataSourceConfig;
  label: string;
}

/** Try to auto-detect a single database from config, env vars, or MCP config. */
function autoDetectDb(cwd: string): DetectedDb | undefined {
  // 1. runcontext.config.yaml
  try {
    const config = loadConfig(cwd);
    if (config.data_sources && Object.keys(config.data_sources).length > 0) {
      const name = Object.keys(config.data_sources)[0]!;
      const ds = config.data_sources[name]!;
      const loc = ds.path ?? ds.connection ?? name;
      return { dsConfig: ds, label: `${ds.adapter} — ${loc} (from runcontext.config.yaml)` };
    }
  } catch { /* no config */ }

  // 2. Environment variables
  if (process.env.DATABASE_URL) {
    try {
      const ds = parseDbUrl(process.env.DATABASE_URL);
      return { dsConfig: ds, label: `${ds.adapter} — $DATABASE_URL` };
    } catch { /* invalid */ }
  }
  if (process.env.DUCKDB_PATH && existsSync(process.env.DUCKDB_PATH)) {
    return {
      dsConfig: { adapter: 'duckdb', path: process.env.DUCKDB_PATH },
      label: `duckdb — $DUCKDB_PATH`,
    };
  }

  // 3. MCP config discovery (multiple files)
  try {
    const discovered = discoverDatabases(cwd);
    if (discovered.length > 0) {
      const first = discovered[0]!;
      const ds = toDataSourceConfig(first);
      if (ds) {
        return { dsConfig: ds, label: first.label };
      }
    }
  } catch { /* discovery failed */ }

  // 4. Legacy fallback: .claude/mcp.json duckdb server
  const mcpPath = path.join(cwd, '.claude', 'mcp.json');
  if (existsSync(mcpPath)) {
    try {
      const mcpConfig = JSON.parse(readFileSync(mcpPath, 'utf-8'));
      const duckdbServer = mcpConfig.mcpServers?.duckdb;
      if (duckdbServer?.args) {
        const args = duckdbServer.args as string[];
        const idx = args.indexOf('--db-path');
        if (idx >= 0 && args[idx + 1]) {
          const dbPath = args[idx + 1]!;
          if (existsSync(dbPath)) {
            return {
              dsConfig: { adapter: 'duckdb', path: dbPath },
              label: `duckdb — ${path.basename(dbPath)} (from .claude/mcp.json)`,
            };
          }
        }
      }
    } catch { /* malformed */ }
  }

  return undefined;
}

/** Discover all databases from MCP config files for the selection menu. */
function discoverAllDatabases(cwd: string): DetectedDb[] {
  try {
    return discoverDatabases(cwd)
      .map((d) => {
        const dsConfig = toDataSourceConfig(d);
        if (!dsConfig) return null;
        return { dsConfig, label: d.label };
      })
      .filter((d): d is DetectedDb => d !== null);
  } catch {
    return [];
  }
}

/** Prompt for file path or env var (DuckDB / SQLite). */
async function promptForFileDb(
  adapter: 'duckdb' | 'sqlite',
  ext: string,
  envDefault: string,
): Promise<DataSourceConfig | undefined> {
  const method = await p.select({
    message: 'How do you connect?',
    options: [
      { value: 'env', label: 'Environment variable', hint: `e.g. ${envDefault}` },
      { value: 'path', label: 'File path', hint: `e.g. ./warehouse${ext}` },
    ],
  });
  if (p.isCancel(method)) return undefined;

  if (method === 'env') {
    const envName = await p.text({
      message: 'Environment variable name',
      initialValue: envDefault,
      validate(value) {
        if (!value) return 'Required';
        const resolved = process.env[value];
        if (!resolved) return `$${value} is not set`;
        if (!existsSync(resolved)) return `$${value} points to "${resolved}" which does not exist`;
      },
    });
    if (p.isCancel(envName)) return undefined;
    return { adapter, path: process.env[envName as string]! } as DataSourceConfig;
  } else {
    const filePath = await p.text({
      message: `Path to ${ext} file`,
      placeholder: `./warehouse${ext}`,
      validate(value) {
        if (!value) return 'Required';
        if (!existsSync(value)) return `File not found: ${value}`;
      },
    });
    if (p.isCancel(filePath)) return undefined;
    return { adapter, path: path.resolve(filePath as string) } as DataSourceConfig;
  }
}

/** Prompt for connection-string based databases (Postgres, MySQL, MSSQL). */
async function promptForConnectionString(
  adapter: 'postgres' | 'mysql' | 'mssql',
  scheme: string,
  envDefault: string,
): Promise<DataSourceConfig | undefined> {
  const method = await p.select({
    message: 'How do you connect?',
    options: [
      { value: 'env', label: 'Environment variable', hint: `e.g. ${envDefault}` },
      { value: 'url', label: 'Connection string', hint: `${scheme}://...` },
    ],
  });
  if (p.isCancel(method)) return undefined;

  if (method === 'env') {
    const envName = await p.text({
      message: 'Environment variable name',
      initialValue: envDefault,
      validate(value) {
        if (!value) return 'Required';
        const resolved = process.env[value];
        if (!resolved) return `$${value} is not set`;
      },
    });
    if (p.isCancel(envName)) return undefined;
    return { adapter, connection: process.env[envName as string]! } as DataSourceConfig;
  } else {
    const url = await p.text({
      message: 'Connection string',
      placeholder: `${scheme}://user:pass@host:5432/dbname`,
      validate(value) {
        if (!value) return 'Required';
        if (!value.startsWith(`${scheme}://`)) {
          return `Must start with ${scheme}://`;
        }
      },
    });
    if (p.isCancel(url)) return undefined;
    return { adapter, connection: url as string } as DataSourceConfig;
  }
}

/** Prompt for Snowflake credentials. */
async function promptForSnowflake(): Promise<DataSourceConfig | undefined> {
  const account = await p.text({
    message: 'Snowflake account identifier',
    placeholder: 'xy12345.us-east-1',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(account)) return undefined;

  const username = await p.text({
    message: 'Username',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(username)) return undefined;

  const password = await p.password({
    message: 'Password',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(password)) return undefined;

  const warehouse = await p.text({
    message: 'Warehouse',
    placeholder: 'COMPUTE_WH',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(warehouse)) return undefined;

  const database = await p.text({
    message: 'Database',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(database)) return undefined;

  const schema = await p.text({
    message: 'Schema',
    initialValue: 'PUBLIC',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(schema)) return undefined;

  return {
    adapter: 'snowflake',
    account: account as string,
    username: username as string,
    password: password as string,
    warehouse: warehouse as string,
    database: database as string,
    schema: schema as string,
  } as DataSourceConfig;
}

/** Prompt for BigQuery credentials. */
async function promptForBigQuery(): Promise<DataSourceConfig | undefined> {
  const project = await p.text({
    message: 'Google Cloud project ID',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(project)) return undefined;

  const dataset = await p.text({
    message: 'Dataset',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(dataset)) return undefined;

  const keyFilename = await p.text({
    message: 'Path to service account key file (JSON)',
    placeholder: './service-account.json',
    validate(value) {
      if (!value) return 'Required';
      if (!existsSync(value)) return `File not found: ${value}`;
    },
  });
  if (p.isCancel(keyFilename)) return undefined;

  return {
    adapter: 'bigquery',
    project: project as string,
    dataset: dataset as string,
    keyFilename: path.resolve(keyFilename as string),
  } as DataSourceConfig;
}

/** Prompt for ClickHouse credentials. */
async function promptForClickHouse(): Promise<DataSourceConfig | undefined> {
  const host = await p.text({
    message: 'Host',
    initialValue: 'localhost',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(host)) return undefined;

  const port = await p.text({
    message: 'HTTP port',
    initialValue: '8123',
    validate(value) {
      if (!value) return 'Required';
      if (!/^\d+$/.test(value)) return 'Must be a number';
    },
  });
  if (p.isCancel(port)) return undefined;

  const database = await p.text({
    message: 'Database',
    initialValue: 'default',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(database)) return undefined;

  const username = await p.text({
    message: 'Username',
    initialValue: 'default',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(username)) return undefined;

  const password = await p.password({
    message: 'Password (leave empty if none)',
  });
  if (p.isCancel(password)) return undefined;

  return {
    adapter: 'clickhouse',
    host: host as string,
    port: parseInt(port as string, 10),
    database: database as string,
    username: username as string,
    password: (password as string) || undefined,
  } as DataSourceConfig;
}

/** Prompt for Databricks credentials. */
async function promptForDatabricks(): Promise<DataSourceConfig | undefined> {
  const serverHostname = await p.text({
    message: 'Server hostname',
    placeholder: 'abc-12345678-wxyz.cloud.databricks.com',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(serverHostname)) return undefined;

  const httpPath = await p.text({
    message: 'HTTP path',
    placeholder: '/sql/1.0/warehouses/abcdef1234567890',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(httpPath)) return undefined;

  const token = await p.password({
    message: 'Personal access token',
    validate(value) { if (!value) return 'Required'; },
  });
  if (p.isCancel(token)) return undefined;

  return {
    adapter: 'databricks',
    serverHostname: serverHostname as string,
    httpPath: httpPath as string,
    token: token as string,
  } as DataSourceConfig;
}

/** Prompt user to select a connector and provide connection details. */
async function promptForConnection(): Promise<DataSourceConfig | undefined> {
  const cwd = process.cwd();
  const discovered = discoverAllDatabases(cwd);

  // Use string values for all options; discovered dbs use "discovered:N" keys
  const discoveredMap = new Map<string, DataSourceConfig>();
  const options: Array<{ value: string; label: string; hint?: string }> = [];

  for (let i = 0; i < discovered.length; i++) {
    const key = `discovered:${i}`;
    discoveredMap.set(key, discovered[i]!.dsConfig);
    options.push({ value: key, label: discovered[i]!.label });
  }

  if (discovered.length > 0) {
    options.push({ value: '__separator__', label: '\u2500\u2500\u2500 Or connect manually \u2500\u2500\u2500' });
  }

  options.push(
    { value: 'duckdb', label: 'DuckDB', hint: 'Local .duckdb file' },
    { value: 'postgres', label: 'PostgreSQL', hint: 'Connection string' },
    { value: 'mysql', label: 'MySQL / MariaDB', hint: 'Connection string' },
    { value: 'mssql', label: 'SQL Server', hint: 'Connection string' },
    { value: 'snowflake', label: 'Snowflake', hint: 'Account credentials' },
    { value: 'bigquery', label: 'BigQuery', hint: 'Google Cloud project' },
    { value: 'clickhouse', label: 'ClickHouse', hint: 'HTTP connection' },
    { value: 'databricks', label: 'Databricks', hint: 'Workspace connection' },
    { value: 'sqlite', label: 'SQLite', hint: 'Local .db file' },
  );

  const selection = await p.select({
    message: 'Select your database',
    options,
  });
  if (p.isCancel(selection)) return undefined;

  const connector = selection as string;

  // If user picked a discovered database, return its config directly
  if (discoveredMap.has(connector)) {
    return discoveredMap.get(connector)!;
  }

  // If user somehow picked the separator, re-prompt
  if (connector === '__separator__') return promptForConnection();

  switch (connector) {
    case 'duckdb':
      return promptForFileDb('duckdb', '.duckdb', 'DUCKDB_PATH');
    case 'sqlite':
      return promptForFileDb('sqlite', '.db', 'SQLITE_PATH');
    case 'postgres':
      return promptForConnectionString('postgres', 'postgres', 'DATABASE_URL');
    case 'mysql':
      return promptForConnectionString('mysql', 'mysql', 'MYSQL_URL');
    case 'mssql':
      return promptForConnectionString('mssql', 'mssql', 'MSSQL_URL');
    case 'snowflake':
      return promptForSnowflake();
    case 'bigquery':
      return promptForBigQuery();
    case 'clickhouse':
      return promptForClickHouse();
    case 'databricks':
      return promptForDatabricks();
    default:
      return undefined;
  }
}

export async function runConnectStep(): Promise<SetupContext | undefined> {
  const cwd = process.cwd();
  let dsConfig: DataSourceConfig;

  // Auto-detect first
  const detected = autoDetectDb(cwd);

  if (detected) {
    p.log.info(`Detected: ${detected.label}`);
    const useDetected = await p.confirm({ message: 'Use this database?' });
    if (p.isCancel(useDetected)) {
      p.cancel('Setup cancelled.');
      return undefined;
    }
    if (useDetected) {
      dsConfig = detected.dsConfig;
    } else {
      const manual = await promptForConnection();
      if (!manual) { p.cancel('Setup cancelled.'); return undefined; }
      dsConfig = manual;
    }
  } else {
    const manual = await promptForConnection();
    if (!manual) { p.cancel('Setup cancelled.'); return undefined; }
    dsConfig = manual;
  }

  // Connect and discover
  const spin = p.spinner();
  spin.start('Connecting to database...');

  let adapter;
  try {
    adapter = await createAdapter(dsConfig);
    await adapter.connect();
  } catch (err) {
    spin.stop('Connection failed');

    if (err instanceof MissingDriverError) {
      p.log.warn(`The ${err.adapter} adapter requires the "${err.driverPackage}" npm package.`);
      const shouldInstall = await p.confirm({
        message: `Install "${err.driverPackage}" now?`,
      });

      if (!p.isCancel(shouldInstall) && shouldInstall) {
        const installSpin = p.spinner();
        installSpin.start(`Installing ${err.driverPackage}...`);
        try {
          // Use execFileSync to avoid shell injection — package name is from a hardcoded map
          execFileSync('npm', ['install', err.driverPackage], {
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          installSpin.stop(`Installed ${err.driverPackage}`);

          // Retry connection
          spin.start('Retrying connection...');
          try {
            adapter = await createAdapter(dsConfig);
            await adapter.connect();
            spin.stop('Connected');
          } catch (retryErr) {
            spin.stop('Connection failed');
            p.log.error((retryErr as Error).message);
            p.cancel('Could not connect to database.');
            return undefined;
          }
        } catch {
          installSpin.stop('Installation failed');
          p.log.error(`Could not install ${err.driverPackage}. Try manually:\n  npm install ${err.driverPackage}`);
          p.cancel('Could not connect to database.');
          return undefined;
        }
      } else {
        p.log.info(`Install it manually with:\n  npm install ${err.driverPackage}`);
        p.cancel('Could not connect to database.');
        return undefined;
      }
    } else {
      p.log.error((err as Error).message);
      p.cancel('Could not connect to database.');
      return undefined;
    }
  }

  const allTables = await adapter.listTables();
  spin.stop(`Found ${allTables.length} tables`);

  // Let user select which tables to include
  let tables = allTables;
  if (allTables.length > 1) {
    const tableSelection = await p.multiselect({
      message: `Select tables to include (${allTables.length} found)`,
      options: allTables.map((t) => ({
        value: t.name,
        label: t.name,
        hint: `${t.row_count.toLocaleString()} rows`,
      })),
      initialValues: allTables.map((t) => t.name),
      required: true,
    });
    if (p.isCancel(tableSelection)) {
      p.cancel('Setup cancelled.');
      await adapter.disconnect();
      return undefined;
    }
    const selected = new Set(tableSelection as string[]);
    tables = allTables.filter((t) => selected.has(t.name));
  }

  // Introspect columns for selected tables
  const colSpin = p.spinner();
  colSpin.start(`Introspecting ${tables.length} tables...`);
  const columns: Record<string, ColumnInfo[]> = {};
  for (const table of tables) {
    columns[table.name] = await adapter.listColumns(table.name);
  }
  const totalCols = Object.values(columns).reduce((sum, c) => sum + c.length, 0);
  colSpin.stop(`${tables.length} tables, ${totalCols} columns`);

  // Show selected tables
  const tableLines = tables
    .map((t) => `  ${t.name.padEnd(30)} ${t.row_count.toLocaleString()} rows`)
    .join('\n');
  p.note(tableLines, 'Selected Tables');

  // Model name
  const defaultModel = path.basename(cwd).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const modelInput = await p.text({
    message: 'Model name',
    initialValue: defaultModel,
    validate(value) {
      if (!value) return 'Required';
      if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
    },
  });
  if (p.isCancel(modelInput)) {
    p.cancel('Setup cancelled.');
    await adapter.disconnect();
    return undefined;
  }

  // Target tier
  const tierInput = await p.select({
    message: 'Target metadata tier',
    options: [
      { value: 'bronze', label: 'Bronze', hint: 'Schema + ownership + grain' },
      { value: 'silver', label: 'Silver', hint: '+ trust, lineage, glossary, refresh, sample values' },
      { value: 'gold', label: 'Gold', hint: '+ semantic roles, rules, golden queries (needs curation)' },
    ],
  });
  if (p.isCancel(tierInput)) {
    p.cancel('Setup cancelled.');
    await adapter.disconnect();
    return undefined;
  }

  // Gather user intent for AI-guided curation
  let intent: UserIntent | undefined;

  const wantsIntent = await p.confirm({
    message: 'Describe what you\'re building? (helps AI agents curate better metadata)',
  });

  if (!p.isCancel(wantsIntent) && wantsIntent) {
    const goalsInput = await p.text({
      message: 'What are you trying to accomplish with this data?',
      placeholder: 'e.g., Analyze coffee shop site selection using demographic and market signals',
    });
    if (p.isCancel(goalsInput)) {
      p.cancel('Setup cancelled.');
      await adapter.disconnect();
      return undefined;
    }

    const metricsInput = await p.text({
      message: 'What metrics or outcomes matter most? (optional)',
      placeholder: 'e.g., opportunity score, supply saturation, demand signals',
    });

    const audienceInput = await p.text({
      message: 'Who will consume this data? (optional)',
      placeholder: 'e.g., AI agents writing SQL, analysts building dashboards',
    });

    intent = {
      goals: goalsInput as string,
      metrics: p.isCancel(metricsInput) ? undefined : (metricsInput as string) || undefined,
      audience: p.isCancel(audienceInput) ? undefined : (audienceInput as string) || undefined,
    };
  }

  // Ensure config file
  const configPath = path.join(cwd, 'runcontext.config.yaml');
  let config;
  try {
    config = loadConfig(cwd);
  } catch {
    config = { context_dir: './context' };
  }

  if (!config.data_sources || Object.keys(config.data_sources).length === 0) {
    const newConfig = {
      context_dir: config.context_dir ?? './context',
      data_sources: { default: dsConfig },
    };
    writeFileSync(configPath, yaml.stringify(newConfig, { lineWidth: 120 }), 'utf-8');
    config = loadConfig(cwd);
  }

  const contextDir = path.resolve(cwd, config.context_dir ?? './context');

  return {
    cwd,
    contextDir,
    dsConfig,
    adapter,
    tables,
    columns,
    modelName: modelInput as string,
    targetTier: tierInput as TargetTier,
    intent,
  };
}
