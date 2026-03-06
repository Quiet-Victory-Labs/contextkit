import * as p from '@clack/prompts';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as yaml from 'yaml';
import { loadConfig, createAdapter } from '@runcontext/core';
import type { ColumnInfo, DataSourceConfig } from '@runcontext/core';
import { parseDbUrl } from '../../commands/introspect.js';
import type { SetupContext, TargetTier } from '../types.js';

interface DetectedDb {
  dsConfig: DataSourceConfig;
  label: string;
}

/** Try to auto-detect a database from config, env vars, or MCP config. */
function autoDetectDb(cwd: string): DetectedDb | undefined {
  // 1. contextkit.config.yaml
  try {
    const config = loadConfig(cwd);
    if (config.data_sources && Object.keys(config.data_sources).length > 0) {
      const name = Object.keys(config.data_sources)[0]!;
      const ds = config.data_sources[name]!;
      const loc = ds.path ?? ds.connection ?? name;
      return { dsConfig: ds, label: `${ds.adapter} — ${loc} (from contextkit.config.yaml)` };
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

  // 3. .claude/mcp.json duckdb server
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

/** Prompt user to select a connector and provide connection details. */
async function promptForConnection(): Promise<DataSourceConfig | undefined> {
  const connector = await p.select({
    message: 'Select your database',
    options: [
      { value: 'duckdb', label: 'DuckDB', hint: 'Local .duckdb file' },
      { value: 'postgres', label: 'PostgreSQL', hint: 'Connection string' },
    ],
  });
  if (p.isCancel(connector)) return undefined;

  if (connector === 'duckdb') {
    const method = await p.select({
      message: 'How do you connect?',
      options: [
        { value: 'env', label: 'Environment variable', hint: 'e.g. DUCKDB_PATH' },
        { value: 'path', label: 'File path', hint: 'e.g. ./warehouse.duckdb' },
      ],
    });
    if (p.isCancel(method)) return undefined;

    if (method === 'env') {
      const envName = await p.text({
        message: 'Environment variable name',
        initialValue: 'DUCKDB_PATH',
        validate(value) {
          if (!value) return 'Required';
          const resolved = process.env[value];
          if (!resolved) return `$${value} is not set`;
          if (!existsSync(resolved)) return `$${value} points to "${resolved}" which does not exist`;
        },
      });
      if (p.isCancel(envName)) return undefined;
      return { adapter: 'duckdb', path: process.env[envName as string]! };
    } else {
      const filePath = await p.text({
        message: 'Path to .duckdb file',
        placeholder: './warehouse.duckdb',
        validate(value) {
          if (!value) return 'Required';
          if (!existsSync(value)) return `File not found: ${value}`;
        },
      });
      if (p.isCancel(filePath)) return undefined;
      return { adapter: 'duckdb', path: path.resolve(filePath as string) };
    }
  } else {
    // Postgres
    const method = await p.select({
      message: 'How do you connect?',
      options: [
        { value: 'env', label: 'Environment variable', hint: 'e.g. DATABASE_URL' },
        { value: 'url', label: 'Connection string', hint: 'postgres://...' },
      ],
    });
    if (p.isCancel(method)) return undefined;

    if (method === 'env') {
      const envName = await p.text({
        message: 'Environment variable name',
        initialValue: 'DATABASE_URL',
        validate(value) {
          if (!value) return 'Required';
          const resolved = process.env[value];
          if (!resolved) return `$${value} is not set`;
        },
      });
      if (p.isCancel(envName)) return undefined;
      return { adapter: 'postgres', connection: process.env[envName as string]! };
    } else {
      const url = await p.text({
        message: 'Connection string',
        placeholder: 'postgres://user:pass@host:5432/dbname',
        validate(value) {
          if (!value) return 'Required';
          if (!value.startsWith('postgres://') && !value.startsWith('postgresql://')) {
            return 'Must start with postgres:// or postgresql://';
          }
        },
      });
      if (p.isCancel(url)) return undefined;
      return { adapter: 'postgres', connection: url as string };
    }
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
    p.log.error((err as Error).message);
    p.cancel('Could not connect to database.');
    return undefined;
  }

  const tables = await adapter.listTables();
  const columns: Record<string, ColumnInfo[]> = {};
  for (const table of tables) {
    columns[table.name] = await adapter.listColumns(table.name);
  }
  const totalCols = Object.values(columns).reduce((sum, c) => sum + c.length, 0);
  spin.stop(`Found ${tables.length} tables, ${totalCols} columns`);

  // Show discovered tables
  const tableLines = tables
    .map((t) => `  ${t.name.padEnd(30)} ${t.row_count.toLocaleString()} rows`)
    .join('\n');
  p.note(tableLines, 'Discovered Tables');

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

  // Ensure config file
  const configPath = path.join(cwd, 'contextkit.config.yaml');
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
  };
}
