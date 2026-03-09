import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';

export interface DetectedSource {
  name: string;
  adapter: string;
  origin: string;
  status: 'detected' | 'connected' | 'error';
}

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
