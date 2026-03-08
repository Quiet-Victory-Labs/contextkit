/**
 * Connector Framework — Type Definitions
 *
 * Interfaces for read-only database introspection. Specific connectors
 * (Postgres, Snowflake, BigQuery, etc.) implement ReadOnlyConnector.
 */

// ── Table & Column metadata ────────────────────────────────────────

export interface TableMeta {
  schema: string;
  name: string;
  type: 'table' | 'view';
  row_count_estimate?: number;
  comment?: string;
}

export interface ColumnMeta {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
  comment?: string;
  default_value?: string;
}

// ── Table statistics ───────────────────────────────────────────────

export interface TableStats {
  schema: string;
  table: string;
  row_count_estimate: number;
  size_bytes?: number;
  last_modified?: string;
}

// ── Relationship detection ─────────────────────────────────────────

export interface RelationshipCandidate {
  from_schema: string;
  from_table: string;
  from_column: string;
  to_schema: string;
  to_table: string;
  to_column: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

// ── Connector configuration ────────────────────────────────────────

export interface ConnectorConfig {
  /** Maximum query execution time in milliseconds. Default: 30 000. */
  query_timeout_ms?: number;
  /** Maximum rows returned by any single query. Default: 10 000. */
  row_limit?: number;
}

// ── Core connector interface ───────────────────────────────────────

export interface ReadOnlyConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listSchemas(): Promise<string[]>;
  listTables(schema?: string): Promise<TableMeta[]>;
  describeTable(schema: string, table: string): Promise<ColumnMeta[]>;
  getTableStats(schema: string, table: string): Promise<TableStats>;
  getViewDefinition(schema: string, view: string): Promise<string | null>;
  detectRelationships(schema?: string): Promise<RelationshipCandidate[]>;
}
