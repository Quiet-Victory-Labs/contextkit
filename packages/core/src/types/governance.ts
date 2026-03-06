export type TrustStatus = 'endorsed' | 'warning' | 'deprecated';
export type SecurityClassification = 'public' | 'internal' | 'confidential' | 'secret';
export type TableType = 'fact' | 'dimension' | 'bridge' | 'snapshot' | 'event' | 'aggregate' | 'view';
export type SemanticRole = 'metric' | 'dimension' | 'identifier' | 'date';
export type DefaultAggregation = 'SUM' | 'AVG' | 'COUNT' | 'COUNT_DISTINCT' | 'MIN' | 'MAX';

export interface DatasetGovernance {
  grain: string;
  refresh?: string;
  table_type: TableType;
  security?: SecurityClassification;
}

export interface FieldGovernance {
  semantic_role?: SemanticRole;
  default_aggregation?: DefaultAggregation;
  additive?: boolean;
  default_filter?: string;
  sample_values?: string[];
}

export interface BusinessContext {
  name: string;
  description: string;
}

export interface GovernanceFile {
  model: string;
  owner: string;
  version?: string;
  trust?: TrustStatus;
  security?: SecurityClassification;
  tags?: string[];
  business_context?: BusinessContext[];
  datasets?: Record<string, DatasetGovernance>;
  fields?: Record<string, FieldGovernance>;
}
