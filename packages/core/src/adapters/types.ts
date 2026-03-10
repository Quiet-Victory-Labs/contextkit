export interface TableInfo {
  name: string;
  type: 'table' | 'view';
  schema?: string;
  row_count: number;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
}

export interface DataAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTables(): Promise<TableInfo[]>;
  listColumns(table: string): Promise<ColumnInfo[]>;
  query(sql: string): Promise<QueryResult>;
}

export type AdapterType =
  | 'duckdb'
  | 'postgres'
  | 'mysql'
  | 'mssql'
  | 'snowflake'
  | 'bigquery'
  | 'clickhouse'
  | 'databricks'
  | 'sqlite';

export interface DataSourceConfig {
  adapter: AdapterType;
  path?: string;           // duckdb, sqlite
  connection?: string;     // postgres, mysql, mssql (connection string)
  // Snowflake
  account?: string;
  username?: string;
  password?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  role?: string;
  // BigQuery
  project?: string;
  dataset?: string;
  keyFilename?: string;
  // ClickHouse
  host?: string;
  port?: number;
  // Databricks
  serverHostname?: string;
  httpPath?: string;
  token?: string;
  auth?: string; // provider:key reference for OAuth credentials
}
