export type { DataAdapter, DataSourceConfig, TableInfo, ColumnInfo, QueryResult } from './types.js';

import type { DataAdapter, DataSourceConfig } from './types.js';

export async function createAdapter(config: DataSourceConfig): Promise<DataAdapter> {
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
    default:
      throw new Error(`Unknown adapter: ${(config as any).adapter}`);
  }
}
