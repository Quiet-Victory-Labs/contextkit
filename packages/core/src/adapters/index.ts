export type { DataAdapter, DataSourceConfig, AdapterType, TableInfo, ColumnInfo, QueryResult, ForeignKeyInfo, IndexInfo, CheckConstraintInfo } from './types.js';
export { MissingDriverError, getDriverPackage } from './errors.js';

import type { DataAdapter, DataSourceConfig } from './types.js';
import { MissingDriverError } from './errors.js';
import { resolveAuthConnection } from '../auth/resolve.js';
import { createDefaultRegistry } from '../auth/providers/index.js';
import { CredentialStore } from '../auth/credential-store.js';

export async function createAdapter(config: DataSourceConfig): Promise<DataAdapter> {
  // If auth key is present, resolve it to a connection string
  if (config.auth && !config.connection) {
    const registry = createDefaultRegistry();
    const store = new CredentialStore();
    config = { ...config, connection: await resolveAuthConnection(config.auth, registry, store) };
  }

  try {
    return await createAdapterInner(config);
  } catch (err) {
    // Detect missing driver errors from either:
    // 1. Node module resolution (ERR_MODULE_NOT_FOUND, Cannot find package)
    // 2. Adapter internal try/catch ("driver not found" pattern)
    const msg = (err as Error).message ?? '';
    if (
      msg.includes('Cannot find package') ||
      msg.includes('Cannot find module') ||
      msg.includes('driver not found') ||
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
