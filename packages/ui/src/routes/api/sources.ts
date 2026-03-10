import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as yaml from 'yaml';

export interface DetectedSource {
  name: string;
  adapter: string;
  origin: string;
  status: 'detected' | 'connected' | 'error';
}

// ---------------------------------------------------------------------------
// Lightweight MCP discovery (reads IDE config files for database servers)
// ---------------------------------------------------------------------------

interface McpServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
  url?: string;
  headers?: Record<string, string>;
}

/** Known MCP server name patterns → adapter type */
const NAME_PATTERNS: Record<string, string> = {
  duckdb: 'duckdb', motherduck: 'duckdb',
  postgres: 'postgres', postgresql: 'postgres', neon: 'postgres', supabase: 'postgres',
  mysql: 'mysql', sqlite: 'sqlite', snowflake: 'snowflake',
  bigquery: 'bigquery', clickhouse: 'clickhouse', databricks: 'databricks',
  mssql: 'mssql', 'sql-server': 'mssql', redshift: 'postgres',
};

/** Known MCP package names → adapter type */
const PACKAGE_PATTERNS: Record<string, string> = {
  '@motherduck/mcp': 'duckdb', 'mcp-server-duckdb': 'duckdb',
  'mcp-server-postgres': 'postgres', 'mcp-server-postgresql': 'postgres',
  '@neon/mcp': 'postgres', '@supabase/mcp': 'postgres',
  'mcp-server-mysql': 'mysql', 'mcp-server-sqlite': 'sqlite',
  'mcp-server-snowflake': 'snowflake', 'mcp-server-bigquery': 'bigquery',
  'mcp-server-clickhouse': 'clickhouse', 'mcp-server-databricks': 'databricks',
  'mcp-server-mssql': 'mssql', 'mcp-server-redshift': 'postgres',
};

function readJsonSafe(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    let raw = fs.readFileSync(filePath, 'utf-8');
    // Strip control characters that break JSON.parse (but keep \n, \r, \t)
    raw = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    // Try parsing as-is first (most configs are valid JSON)
    try {
      return JSON.parse(raw);
    } catch {
      // Strip JSONC comments: only // at line start or after whitespace (not inside strings like URLs)
      const cleaned = raw
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(cleaned);
    }
  } catch {
    return null;
  }
}

function getConfigLocations(cwd: string): Array<{ ide: string; path: string }> {
  const home = os.homedir();
  const locations: Array<{ ide: string; path: string }> = [];

  // Claude Code
  locations.push({ ide: 'claude-code', path: path.join(cwd, '.mcp.json') });
  locations.push({ ide: 'claude-code', path: path.join(home, '.claude.json') });
  locations.push({ ide: 'claude-code', path: path.join(home, '.claude', 'mcp_servers.json') });

  // Claude Desktop
  if (process.platform === 'darwin') {
    locations.push({ ide: 'claude-desktop', path: path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json') });
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    locations.push({ ide: 'claude-desktop', path: path.join(appData, 'Claude', 'claude_desktop_config.json') });
  } else {
    locations.push({ ide: 'claude-desktop', path: path.join(home, '.config', 'claude', 'claude_desktop_config.json') });
  }

  // Cursor
  locations.push({ ide: 'cursor', path: path.join(cwd, '.cursor', 'mcp.json') });
  locations.push({ ide: 'cursor', path: path.join(home, '.cursor', 'mcp.json') });
  if (process.platform === 'darwin') {
    locations.push({ ide: 'cursor', path: path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'mcp.json') });
  }

  // VS Code
  locations.push({ ide: 'vscode', path: path.join(cwd, '.vscode', 'mcp.json') });

  // Windsurf
  locations.push({ ide: 'windsurf', path: path.join(cwd, '.windsurf', 'mcp.json') });
  if (process.platform === 'darwin') {
    locations.push({ ide: 'windsurf', path: path.join(home, 'Library', 'Application Support', 'Windsurf', 'User', 'globalStorage', 'windsurf.mcp', 'mcp.json') });
  }

  return locations;
}

function detectAdapterType(serverName: string, entry: McpServerEntry): string | null {
  const nameLower = serverName.toLowerCase();

  // Check server name patterns
  for (const [pattern, adapter] of Object.entries(NAME_PATTERNS)) {
    if (nameLower.includes(pattern)) return adapter;
  }

  // Check package name in args (command-based servers)
  const args = entry.args ?? [];
  const allArgs = [entry.command ?? '', ...args].join(' ').toLowerCase();
  for (const [pkg, adapter] of Object.entries(PACKAGE_PATTERNS)) {
    if (allArgs.includes(pkg.toLowerCase())) return adapter;
  }

  // Check URL for HTTP-type servers (e.g. mcp.neon.tech → neon → postgres)
  if (entry.url) {
    const urlLower = entry.url.toLowerCase();
    for (const [pattern, adapter] of Object.entries(NAME_PATTERNS)) {
      if (urlLower.includes(pattern)) return adapter;
    }
  }

  return null;
}

function discoverMcpDatabases(cwd: string): DetectedSource[] {
  const results: DetectedSource[] = [];
  const seen = new Set<string>();

  try {
    const locations = getConfigLocations(cwd);

    for (const loc of locations) {
      const json = readJsonSafe(loc.path) as Record<string, unknown> | null;
      if (!json) continue;

      // Extract mcpServers from various config formats
      const servers = (json.mcpServers ?? json.mcp_servers ?? json.servers ?? json) as Record<string, McpServerEntry>;
      if (!servers || typeof servers !== 'object') continue;

      for (const [serverName, entry] of Object.entries(servers)) {
        if (!entry || typeof entry !== 'object') continue;

        const adapterType = detectAdapterType(serverName, entry);
        if (!adapterType) continue;

        const key = `${adapterType}:${serverName}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Build a friendly label
        const dbInfo = extractDbName(entry);
        const label = dbInfo
          ? `${serverName} (${adapterType}${dbInfo ? ' — ' + dbInfo : ''})`
          : `${serverName} (${adapterType})`;

        results.push({
          name: label,
          adapter: adapterType,
          origin: `mcp:${loc.ide}/${serverName}`,
          status: 'detected',
        });
      }
    }
  } catch {
    // Discovery is best-effort
  }

  return results;
}

function extractDbName(entry: McpServerEntry): string {
  const args = entry.args ?? [];
  // Look for database name in common arg patterns
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // --database, --db, --dbname flags
    if ((arg === '--database' || arg === '--db' || arg === '--dbname') && args[i + 1]) {
      return args[i + 1];
    }
    // Connection URL
    if (arg && /^(postgres|mysql|mssql|clickhouse):\/\//.test(arg)) {
      try {
        const u = new URL(arg);
        return u.pathname.replace(/^\//, '') || u.hostname;
      } catch { /* ignore */ }
    }
  }
  // Check env vars for connection info
  if (entry.env) {
    for (const [key, val] of Object.entries(entry.env)) {
      if (/^(DATABASE_URL|POSTGRES_URL|PG_CONNECTION)/.test(key) && val) {
        try {
          const u = new URL(val);
          return u.pathname.replace(/^\//, '') || u.hostname;
        } catch { /* ignore */ }
      }
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function sourcesRoutes(rootDir: string, contextDir: string): Hono {
  const app = new Hono();

  app.get('/api/sources', (c) => {
    const sources: DetectedSource[] = [];

    // Read data_sources from runcontext.config.yaml
    try {
      const configPath = path.join(rootDir, 'runcontext.config.yaml');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const config = yaml.parse(raw);
        if (config?.data_sources && typeof config.data_sources === 'object') {
          for (const [name, ds] of Object.entries(config.data_sources)) {
            const src = ds as { adapter?: string; connection?: string; path?: string };
            sources.push({
              name,
              adapter: src.adapter ?? 'auto',
              origin: `config:${name}`,
              status: 'detected',
            });
          }
        }
      }
    } catch {
      // ignore config read errors
    }

    // Check environment variables for common databases
    const envChecks: Array<{ env: string; adapter: string; name: string }> = [
      { env: 'DATABASE_URL', adapter: 'auto', name: 'Database (DATABASE_URL)' },
      { env: 'POSTGRES_URL', adapter: 'postgres', name: 'PostgreSQL' },
      { env: 'PG_CONNECTION_STRING', adapter: 'postgres', name: 'PostgreSQL' },
      { env: 'SNOWFLAKE_ACCOUNT', adapter: 'snowflake', name: 'Snowflake' },
      { env: 'BIGQUERY_PROJECT', adapter: 'bigquery', name: 'BigQuery' },
      { env: 'CLICKHOUSE_URL', adapter: 'clickhouse', name: 'ClickHouse' },
      { env: 'DATABRICKS_HOST', adapter: 'databricks', name: 'Databricks' },
    ];

    for (const check of envChecks) {
      if (process.env[check.env]) {
        sources.push({
          name: check.name,
          adapter: check.adapter,
          origin: `env:${check.env}`,
          status: 'detected',
        });
      }
    }

    // Check for local DuckDB files
    const duckdbFiles = ['*.duckdb', '*.db', '*.ddb'];
    for (const pattern of duckdbFiles) {
      const ext = pattern.replace('*', '');
      try {
        const files = fs.readdirSync(rootDir).filter((f) => f.endsWith(ext));
        for (const file of files) {
          sources.push({
            name: `DuckDB: ${file}`,
            adapter: 'duckdb',
            origin: `file:${file}`,
            status: 'detected',
          });
        }
      } catch {
        // ignore read errors
      }
    }

    // Check for SQLite files
    try {
      const sqliteFiles = fs.readdirSync(rootDir).filter((f) => f.endsWith('.sqlite') || f.endsWith('.sqlite3'));
      for (const file of sqliteFiles) {
        sources.push({
          name: `SQLite: ${file}`,
          adapter: 'sqlite',
          origin: `file:${file}`,
          status: 'detected',
        });
      }
    } catch {
      // ignore
    }

    // MCP discovery: scan IDE configs for database MCP servers
    const mcpSources = discoverMcpDatabases(rootDir);
    for (const mcp of mcpSources) {
      // Skip duplicates already found via config/env/files
      const alreadyFound = sources.some((s) =>
        s.origin === mcp.origin || (s.adapter === mcp.adapter && s.name === mcp.name)
      );
      if (!alreadyFound) {
        sources.push(mcp);
      }
    }

    return c.json(sources);
  });

  app.post('/api/sources', async (c) => {
    const body = await c.req.json<{ connection: string; name?: string }>();
    const { connection, name = 'default' } = body;

    if (!connection) {
      return c.json({ error: 'connection is required' }, 400);
    }

    // Detect adapter from URL prefix
    let adapter = 'auto';
    if (connection.startsWith('postgres://') || connection.startsWith('postgresql://')) {
      adapter = 'postgres';
    } else if (connection.startsWith('mysql://')) {
      adapter = 'mysql';
    } else if (connection.startsWith('mssql://') || connection.startsWith('sqlserver://')) {
      adapter = 'mssql';
    } else if (connection.startsWith('clickhouse://')) {
      adapter = 'clickhouse';
    }

    // Read existing config or create new
    const configPath = path.join(rootDir, 'runcontext.config.yaml');
    let config: Record<string, unknown> = {};
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        config = yaml.parse(raw) ?? {};
      }
    } catch {
      // start fresh
    }

    if (!config.data_sources || typeof config.data_sources !== 'object') {
      config.data_sources = {};
    }

    const dataSources = config.data_sources as Record<string, { adapter: string; connection: string }>;
    dataSources[name] = { adapter, connection };

    fs.writeFileSync(configPath, yaml.stringify(config), 'utf-8');

    const created: DetectedSource = {
      name,
      adapter,
      origin: `config:${name}`,
      status: 'detected',
    };

    return c.json(created, 201);
  });

  return app;
}
