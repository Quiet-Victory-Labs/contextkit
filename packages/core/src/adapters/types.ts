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

export interface DataSourceConfig {
  adapter: 'duckdb' | 'postgres';
  path?: string;
  connection?: string;
}
