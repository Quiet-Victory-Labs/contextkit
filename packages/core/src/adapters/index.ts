export type { DataAdapter, DataSourceConfig, AdapterType, TableInfo, ColumnInfo, QueryResult } from './types.js';

import type { DataAdapter, DataSourceConfig } from './types.js';

/** Map adapter type to its npm driver package. */
const DRIVER_PACKAGES: Record<string, string> = {
  duckdb: 'duckdb',
  postgres: 'pg',
  mysql: 'mysql2',
  mssql: 'mssql',
  snowflake: 'snowflake-sdk',
  bigquery: '@google-cloud/bigquery',
  clickhouse: '@clickhouse/client',
  databricks: '@databricks/sql',
  sqlite: 'better-sqlite3',
};

/** Error thrown when a database driver is not installed. */
export class MissingDriverError extends Error {
  public readonly adapter: string;
  public readonly driverPackage: string;

  constructor(adapter: string) {
    const pkg = DRIVER_PACKAGES[adapter] ?? adapter;
    super(`Missing database driver: "${pkg}" is required for the ${adapter} adapter.\n\nInstall it with:\n  npm install ${pkg}`);
    this.name = 'MissingDriverError';
    this.adapter = adapter;
    this.driverPackage = pkg;
  }
}

/** Get the npm package name for a given adapter type. */
export function getDriverPackage(adapter: string): string | undefined {
  return DRIVER_PACKAGES[adapter];
}

export async function createAdapter(config: DataSourceConfig): Promise<DataAdapter> {
  try {
    return await createAdapterInner(config);
  } catch (err) {
    // Detect missing driver errors (ERR_MODULE_NOT_FOUND, MODULE_NOT_FOUND, Cannot find package)
    const msg = (err as Error).message ?? '';
    if (
      msg.includes('Cannot find package') ||
      msg.includes('Cannot find module') ||
      (err as any)?.code === 'ERR_MODULE_NOT_FOUND' ||
      (err as any)?.code === 'MODULE_NOT_FOUND'
    ) {
      throw new MissingDriverError(config.adapter);
    }
    throw err;
  }
}

async function createAdapterInner(config: DataSourceConfig): Promise<DataAdapter> {
  switch (config.adapter) {
    case 'duckdb': {
      if (!config.path) throw new Error('DuckDB adapter requires "path"');
      const { DuckDBAdapter } = await import('./duckdb.js');
      return new DuckDBAdapter(config.path);
    }
    case 'postgres': {
      if (!config.connection) throw new Error('Postgres adapter requires "connection"');
      const { PostgresAdapter } = await import('./postgres.js');
      return new PostgresAdapter(config.connection);
    }
    case 'mysql': {
      if (!config.connection) throw new Error('MySQL adapter requires "connection"');
      const { MySQLAdapter } = await import('./mysql.js');
      return new MySQLAdapter(config.connection);
    }
    case 'mssql': {
      if (!config.connection) throw new Error('MSSQL adapter requires "connection"');
      const { MSSQLAdapter } = await import('./mssql.js');
      return new MSSQLAdapter(config.connection);
    }
    case 'snowflake': {
      if (!config.account) throw new Error('Snowflake adapter requires "account"');
      const { SnowflakeAdapter } = await import('./snowflake.js');
      return new SnowflakeAdapter(config);
    }
    case 'bigquery': {
      if (!config.project) throw new Error('BigQuery adapter requires "project"');
      if (!config.dataset) throw new Error('BigQuery adapter requires "dataset"');
      const { BigQueryAdapter } = await import('./bigquery.js');
      return new BigQueryAdapter(config);
    }
    case 'clickhouse': {
      const { ClickHouseAdapter } = await import('./clickhouse.js');
      return new ClickHouseAdapter(config);
    }
    case 'databricks': {
      if (!config.serverHostname) throw new Error('Databricks adapter requires "serverHostname"');
      if (!config.httpPath) throw new Error('Databricks adapter requires "httpPath"');
      if (!config.token) throw new Error('Databricks adapter requires "token"');
      const { DatabricksAdapter } = await import('./databricks.js');
      return new DatabricksAdapter(config);
    }
    case 'sqlite': {
      if (!config.path) throw new Error('SQLite adapter requires "path"');
      const { SQLiteAdapter } = await import('./sqlite.js');
      return new SQLiteAdapter(config.path);
    }
    default:
      throw new Error(`Unknown adapter: ${(config as any).adapter}`);
  }
}
