export interface ForeignKeyInfo {
  column: string;
  referenced_table: string;
  referenced_column: string;
  constraint_name?: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  is_unique: boolean;
}

export interface CheckConstraintInfo {
  name: string;
  expression: string;
}

export interface TableInfo {
  name: string;
  type: 'table' | 'view';
  schema?: string;
  row_count: number;
  comment?: string;
  foreign_keys?: ForeignKeyInfo[];
  indexes?: IndexInfo[];
  check_constraints?: CheckConstraintInfo[];
  partition_key?: string;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
  comment?: string;
  default_value?: string;
  enum_values?: string[];
  is_unique?: boolean;
  is_foreign_key?: boolean;
  referenced_table?: string;
  referenced_column?: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
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
  | 'sqlite'
  | 'mongodb';

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
