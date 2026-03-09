import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AdapterType, DataSourceConfig } from '@runcontext/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpConfigLocation {
  ide: string;   // 'claude-code' | 'cursor' | 'vscode' | 'windsurf' | 'claude-desktop'
  scope: string; // 'user' | 'project' | 'managed'
  path: string;  // resolved absolute path
}

export interface DiscoveredDatabase {
  ide: string;
  scope: string;
  serverName: string;
  adapterType: AdapterType;
  connectionDetails: {
    path?: string;
    connection?: string;
    host?: string;
    port?: number;
    database?: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Server-name substrings that hint at a database adapter type. */
const NAME_PATTERNS: Record<string, AdapterType> = {
  duckdb: 'duckdb',
  motherduck: 'duckdb',
  postgres: 'postgres',
  postgresql: 'postgres',
  neon: 'postgres',
  supabase: 'postgres',
  mysql: 'mysql',
  sqlite: 'sqlite',
  snowflake: 'snowflake',
  bigquery: 'bigquery',
  clickhouse: 'clickhouse',
  databricks: 'databricks',
  mssql: 'mssql',
  'sql-server': 'mssql',
  redshift: 'postgres', // Redshift is Postgres-compatible
};

/** Known MCP package names mapped to adapter types. */
const PACKAGE_PATTERNS: Record<string, AdapterType> = {
  '@motherduck/mcp': 'duckdb',
  'mcp-server-duckdb': 'duckdb',
  'mcp-server-postgres': 'postgres',
  'mcp-server-postgresql': 'postgres',
  '@neon/mcp': 'postgres',
  '@supabase/mcp': 'postgres',
  'mcp-server-mysql': 'mysql',
  'mcp-server-sqlite': 'sqlite',
  'mcp-server-snowflake': 'snowflake',
  'mcp-server-bigquery': 'bigquery',
  'mcp-server-clickhouse': 'clickhouse',
  'mcp-server-databricks': 'databricks',
  'mcp-server-mssql': 'mssql',
  'mcp-server-redshift': 'postgres',
};

/** Environment variable names that typically hold connection info. */
const CONNECTION_ENV_VARS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRESQL_URL',
  'PG_CONNECTION_STRING',
  'MYSQL_URL',
  'MYSQL_CONNECTION_STRING',
  'DUCKDB_PATH',
  'SQLITE_PATH',
  'SNOWFLAKE_ACCOUNT',
  'BIGQUERY_PROJECT',
  'CLICKHOUSE_URL',
  'DATABRICKS_HOST',
  'MSSQL_CONNECTION_STRING',
  'REDSHIFT_URL',
];

/** CLI flag names that carry connection details. */
const CONNECTION_FLAGS = [
  '--db-path',
  '--database',
  '--connection-string',
  '--connection',
  '--host',
  '--port',
  '--db',
  '--dsn',
];

/** URI scheme prefixes for inline connection strings. */
const URI_SCHEMES: Record<string, AdapterType> = {
  'postgres://': 'postgres',
  'postgresql://': 'postgres',
  'mysql://': 'mysql',
  'clickhouse://': 'clickhouse',
  'mssql://': 'mssql',
  'jdbc:': 'postgres', // conservative fallback
};

// ---------------------------------------------------------------------------
// Config location helpers
// ---------------------------------------------------------------------------

function getConfigLocations(cwd: string): McpConfigLocation[] {
  const home = os.homedir();
  const isMac = process.platform === 'darwin';

  const locations: McpConfigLocation[] = [
    // Claude Code
    { ide: 'claude-code', scope: 'user', path: path.join(home, '.claude.json') },
    { ide: 'claude-code', scope: 'project', path: path.join(cwd, '.mcp.json') },

    // Cursor
    { ide: 'cursor', scope: 'user', path: path.join(home, '.cursor', 'mcp.json') },
    { ide: 'cursor', scope: 'project', path: path.join(cwd, '.cursor', 'mcp.json') },

    // VS Code / Copilot
    { ide: 'vscode', scope: 'project', path: path.join(cwd, '.vscode', 'mcp.json') },

    // Windsurf
    { ide: 'windsurf', scope: 'user', path: path.join(home, '.codeium', 'windsurf', 'mcp_config.json') },
  ];

  if (isMac) {
    locations.push(
      {
        ide: 'claude-code',
        scope: 'managed',
        path: path.join('/', 'Library', 'Application Support', 'ClaudeCode', 'managed-mcp.json'),
      },
      {
        ide: 'claude-desktop',
        scope: 'user',
        path: path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      },
    );
  }

  return locations;
}

// ---------------------------------------------------------------------------
// JSON parsing helpers
// ---------------------------------------------------------------------------

function readJsonSafe(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Extract the servers map from a parsed config.
 * VS Code uses `servers`, everything else uses `mcpServers`.
 */
function extractServers(
  json: unknown,
  ide: string,
): Record<string, McpServerEntry> | null {
  if (json === null || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;

  // VS Code uses the `servers` key
  if (ide === 'vscode') {
    const servers = obj['servers'];
    if (servers && typeof servers === 'object') {
      return servers as Record<string, McpServerEntry>;
    }
    return null;
  }

  // Everything else: mcpServers
  const mcpServers = obj['mcpServers'];
  if (mcpServers && typeof mcpServers === 'object') {
    return mcpServers as Record<string, McpServerEntry>;
  }
  return null;
}

interface McpServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Environment variable expansion
// ---------------------------------------------------------------------------

/**
 * Expand `${VAR}` and `${VAR:-default}` patterns using process.env.
 */
function expandEnvValue(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    const defaultSep = expr.indexOf(':-');
    if (defaultSep !== -1) {
      const varName = expr.slice(0, defaultSep);
      const defaultVal = expr.slice(defaultSep + 2);
      return process.env[varName] ?? defaultVal;
    }
    return process.env[expr] ?? '';
  });
}

function expandEnvMap(env: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!env) return undefined;
  const expanded: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    expanded[key] = expandEnvValue(String(value));
  }
  return expanded;
}

// ---------------------------------------------------------------------------
// Adapter type detection
// ---------------------------------------------------------------------------

function detectAdapterType(
  serverName: string,
  entry: McpServerEntry,
): AdapterType | null {
  const nameLower = serverName.toLowerCase();

  // 1. Match by server name substring
  for (const [pattern, adapter] of Object.entries(NAME_PATTERNS)) {
    if (nameLower.includes(pattern)) return adapter;
  }

  // 2. Match by known package in command or args
  const allTokens = [entry.command ?? '', ...(entry.args ?? [])].map((s) =>
    String(s).toLowerCase(),
  );
  for (const [pkg, adapter] of Object.entries(PACKAGE_PATTERNS)) {
    if (allTokens.some((t) => t.includes(pkg.toLowerCase()))) return adapter;
  }

  // 3. Match by database-related CLI flags in args
  const argsStr = (entry.args ?? []).join(' ').toLowerCase();
  for (const flag of CONNECTION_FLAGS) {
    if (argsStr.includes(flag)) {
      // Try to infer adapter from surrounding context
      return inferAdapterFromArgs(entry.args ?? []);
    }
  }

  // 4. Match by env var names
  if (entry.env) {
    for (const envVar of CONNECTION_ENV_VARS) {
      if (envVar in entry.env) {
        return inferAdapterFromEnvVar(envVar, entry.env[envVar] ?? '');
      }
    }
  }

  // 5. Match by URI scheme in args
  for (const arg of entry.args ?? []) {
    for (const [scheme, adapter] of Object.entries(URI_SCHEMES)) {
      if (String(arg).startsWith(scheme)) return adapter;
    }
  }

  return null;
}

function inferAdapterFromEnvVar(varName: string, value: string): AdapterType | null {
  const upper = varName.toUpperCase();
  if (upper.includes('POSTGRES') || upper.includes('PG_')) return 'postgres';
  if (upper.includes('MYSQL')) return 'mysql';
  if (upper.includes('DUCKDB')) return 'duckdb';
  if (upper.includes('SQLITE')) return 'sqlite';
  if (upper.includes('SNOWFLAKE')) return 'snowflake';
  if (upper.includes('BIGQUERY')) return 'bigquery';
  if (upper.includes('CLICKHOUSE')) return 'clickhouse';
  if (upper.includes('DATABRICKS')) return 'databricks';
  if (upper.includes('MSSQL')) return 'mssql';
  if (upper.includes('REDSHIFT')) return 'postgres';

  // Fall back to checking the value for URI schemes
  if (upper === 'DATABASE_URL') {
    for (const [scheme, adapter] of Object.entries(URI_SCHEMES)) {
      if (String(value).startsWith(scheme)) return adapter;
    }
  }

  return 'postgres'; // conservative default for DATABASE_URL-style vars
}

function inferAdapterFromArgs(args: string[]): AdapterType | null {
  const joined = args.join(' ').toLowerCase();
  for (const [scheme, adapter] of Object.entries(URI_SCHEMES)) {
    if (joined.includes(scheme)) return adapter;
  }
  // Check for file extensions that hint at the adapter
  if (joined.includes('.duckdb') || joined.includes('.db') || joined.includes('duckdb')) return 'duckdb';
  if (joined.includes('.sqlite') || joined.includes('.sqlite3')) return 'sqlite';
  return null;
}

// ---------------------------------------------------------------------------
// Connection detail extraction
// ---------------------------------------------------------------------------

function extractConnectionDetails(
  entry: McpServerEntry,
  adapterType: AdapterType,
): DiscoveredDatabase['connectionDetails'] {
  const args = (entry.args ?? []).map(String);
  const env = expandEnvMap(entry.env);
  const command = String(entry.command ?? '');

  const details: DiscoveredDatabase['connectionDetails'] = {
    command,
    args,
    env,
  };

  // Extract from CLI flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = i + 1 < args.length ? args[i + 1] : undefined;

    if ((arg === '--db-path' || arg === '--database' || arg === '--db') && nextArg) {
      if (adapterType === 'duckdb' || adapterType === 'sqlite') {
        details.path = nextArg;
      } else {
        details.database = nextArg;
      }
    }
    if ((arg === '--connection-string' || arg === '--connection' || arg === '--dsn') && nextArg) {
      details.connection = nextArg;
    }
    if (arg === '--host' && nextArg) {
      details.host = nextArg;
    }
    if (arg === '--port' && nextArg) {
      const port = parseInt(nextArg, 10);
      if (!isNaN(port)) details.port = port;
    }
  }

  // Extract inline connection strings from positional args
  if (!details.connection && !details.path) {
    for (const arg of args) {
      for (const scheme of Object.keys(URI_SCHEMES)) {
        if (arg.startsWith(scheme)) {
          details.connection = arg;
          break;
        }
      }
      if (details.connection) break;

      // Check for file paths that look like databases
      if (
        (adapterType === 'duckdb' || adapterType === 'sqlite') &&
        (arg.endsWith('.duckdb') || arg.endsWith('.db') || arg.endsWith('.sqlite') || arg.endsWith('.sqlite3'))
      ) {
        details.path = arg;
        break;
      }
    }
  }

  // Extract from environment variables
  if (env) {
    if (!details.connection) {
      for (const varName of CONNECTION_ENV_VARS) {
        if (env[varName]) {
          const val = env[varName];
          // URI-style connection strings
          for (const scheme of Object.keys(URI_SCHEMES)) {
            if (val.startsWith(scheme)) {
              details.connection = val;
              break;
            }
          }
          if (details.connection) break;

          // File path for duckdb/sqlite
          if (
            (adapterType === 'duckdb' || adapterType === 'sqlite') &&
            (varName.includes('PATH') || varName.includes('DATABASE'))
          ) {
            details.path = val;
            break;
          }
        }
      }
    }

    // Pick up host/port/database from common env vars
    if (!details.host && env['HOST']) details.host = env['HOST'];
    if (!details.host && env['DB_HOST']) details.host = env['DB_HOST'];
    if (!details.port && env['PORT']) {
      const p = parseInt(env['PORT'], 10);
      if (!isNaN(p)) details.port = p;
    }
    if (!details.port && env['DB_PORT']) {
      const p = parseInt(env['DB_PORT'], 10);
      if (!isNaN(p)) details.port = p;
    }
    if (!details.database && env['DB_NAME']) details.database = env['DB_NAME'];
  }

  return details;
}

// ---------------------------------------------------------------------------
// Label building
// ---------------------------------------------------------------------------

const IDE_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  vscode: 'VS Code',
  windsurf: 'Windsurf',
  'claude-desktop': 'Claude Desktop',
};

const ADAPTER_LABELS: Record<AdapterType, string> = {
  duckdb: 'DuckDB',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  snowflake: 'Snowflake',
  bigquery: 'BigQuery',
  clickhouse: 'ClickHouse',
  databricks: 'Databricks',
  mssql: 'SQL Server',
};

function buildLabel(
  serverName: string,
  adapterType: AdapterType,
  details: DiscoveredDatabase['connectionDetails'],
  ide: string,
): string {
  const adapterLabel = ADAPTER_LABELS[adapterType] ?? adapterType;
  const ideLabel = IDE_LABELS[ide] ?? ide;

  // Try to find a meaningful descriptor
  let descriptor = '';
  if (details.path) {
    descriptor = path.basename(details.path);
  } else if (details.database) {
    descriptor = details.database;
  } else if (details.connection) {
    // Extract database name from connection string
    try {
      const url = new URL(details.connection);
      const dbName = url.pathname.replace(/^\//, '');
      if (dbName) descriptor = dbName;
    } catch {
      // Not a parseable URL; use host if available
    }
  }
  if (!descriptor && details.host) {
    descriptor = details.host;
  }

  if (descriptor) {
    return `${adapterLabel} \u2014 ${descriptor} (from ${ideLabel})`;
  }
  return `${adapterLabel} \u2014 ${serverName} (from ${ideLabel})`;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function deduplicationKey(db: DiscoveredDatabase): string {
  const parts: string[] = [db.adapterType];
  if (db.connectionDetails.path) parts.push(db.connectionDetails.path);
  if (db.connectionDetails.connection) parts.push(db.connectionDetails.connection);
  if (db.connectionDetails.host) parts.push(db.connectionDetails.host);
  if (db.connectionDetails.port) parts.push(String(db.connectionDetails.port));
  if (db.connectionDetails.database) parts.push(db.connectionDetails.database);
  // If no distinguishing details, use server name to avoid collapsing unrelated entries
  if (parts.length === 1) parts.push(db.serverName);
  return parts.join('|');
}

// ---------------------------------------------------------------------------
// Main discovery
// ---------------------------------------------------------------------------

/**
 * Scans all known IDE MCP config files and discovers database connections
 * that the user already has configured.
 *
 * Never throws. Returns an empty array if nothing is found or on any error.
 */
export function discoverDatabases(cwd: string): DiscoveredDatabase[] {
  const results: DiscoveredDatabase[] = [];

  try {
    const locations = getConfigLocations(cwd);

    for (const loc of locations) {
      try {
        const json = readJsonSafe(loc.path);
        if (json === null) continue;

        const servers = extractServers(json, loc.ide);
        if (!servers) continue;

        for (const [serverName, entry] of Object.entries(servers)) {
          try {
            if (!entry || typeof entry !== 'object') continue;

            const adapterType = detectAdapterType(serverName, entry);
            if (!adapterType) continue;

            const connectionDetails = extractConnectionDetails(entry, adapterType);
            const label = buildLabel(serverName, adapterType, connectionDetails, loc.ide);

            results.push({
              ide: loc.ide,
              scope: loc.scope,
              serverName,
              adapterType,
              connectionDetails,
              label,
            });
          } catch {
            // Skip malformed server entry
          }
        }
      } catch {
        // Skip unreadable/malformed config file
      }
    }
  } catch {
    // Fatal-level error — return whatever we have
  }

  // Deduplicate: keep the first occurrence (project-scoped sorts first)
  const scopeOrder: Record<string, number> = { project: 0, user: 1, managed: 2 };
  results.sort((a, b) => {
    const sa = scopeOrder[a.scope] ?? 9;
    const sb = scopeOrder[b.scope] ?? 9;
    return sa - sb;
  });

  const seen = new Set<string>();
  const deduped: DiscoveredDatabase[] = [];
  for (const db of results) {
    const key = deduplicationKey(db);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(db);
    }
  }

  return deduped;
}

// ---------------------------------------------------------------------------
// Conversion to DataSourceConfig
// ---------------------------------------------------------------------------

/**
 * Converts a DiscoveredDatabase into a DataSourceConfig that can be written
 * into runcontext.config.yaml.  Returns null if the connection details are
 * insufficient to create a usable config.
 */
export function toDataSourceConfig(discovered: DiscoveredDatabase): DataSourceConfig | null {
  const { adapterType, connectionDetails } = discovered;

  switch (adapterType) {
    case 'duckdb':
    case 'sqlite': {
      const filePath = connectionDetails.path;
      if (!filePath) return null;
      return { adapter: adapterType, path: filePath };
    }

    case 'postgres':
    case 'mysql':
    case 'mssql': {
      if (connectionDetails.connection) {
        return { adapter: adapterType, connection: connectionDetails.connection };
      }
      // Try to build from host/port/database
      if (connectionDetails.host) {
        const config: DataSourceConfig = {
          adapter: adapterType,
          host: connectionDetails.host,
        };
        if (connectionDetails.port) config.port = connectionDetails.port;
        if (connectionDetails.database) config.database = connectionDetails.database;
        return config;
      }
      return null;
    }

    case 'snowflake': {
      // Need at minimum an account
      if (connectionDetails.host) {
        return {
          adapter: 'snowflake',
          account: connectionDetails.host,
          database: connectionDetails.database,
        };
      }
      return null;
    }

    case 'bigquery': {
      if (connectionDetails.database) {
        return {
          adapter: 'bigquery',
          project: connectionDetails.database,
        };
      }
      return null;
    }

    case 'clickhouse': {
      if (connectionDetails.connection) {
        return { adapter: 'clickhouse', host: connectionDetails.connection };
      }
      if (connectionDetails.host) {
        const config: DataSourceConfig = {
          adapter: 'clickhouse',
          host: connectionDetails.host,
        };
        if (connectionDetails.port) config.port = connectionDetails.port;
        if (connectionDetails.database) config.database = connectionDetails.database;
        return config;
      }
      return null;
    }

    case 'databricks': {
      if (connectionDetails.host) {
        return {
          adapter: 'databricks',
          serverHostname: connectionDetails.host,
        };
      }
      return null;
    }

    default:
      return null;
  }
}
