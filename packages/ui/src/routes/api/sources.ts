import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

  return app;
}
