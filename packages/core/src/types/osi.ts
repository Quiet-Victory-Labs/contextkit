// Mirrors https://github.com/open-semantic-interchange/OSI core-spec/osi-schema.json

export type Dialect = 'ANSI_SQL' | 'SNOWFLAKE' | 'MDX' | 'TABLEAU' | 'DATABRICKS';
export type Vendor = 'COMMON' | 'SNOWFLAKE' | 'SALESFORCE' | 'DBT' | 'DATABRICKS';

export interface AIContext {
  instructions?: string;
  synonyms?: string[];
  examples?: string[];
}

export interface CustomExtension {
  vendor_name: Vendor;
  data: string;
}

export interface DialectExpression {
  dialect: Dialect;
  expression: string;
}

export interface Expression {
  dialects: DialectExpression[];
}

export interface Dimension {
  is_time?: boolean;
}

export interface OsiField {
  name: string;
  expression: Expression;
  dimension?: Dimension;
  label?: string;
  description?: string;
  ai_context?: string | AIContext;
  custom_extensions?: CustomExtension[];
}

export interface OsiDataset {
  name: string;
  source: string;
  primary_key?: string[];
  unique_keys?: string[][];
  description?: string;
  ai_context?: string | AIContext;
  fields?: OsiField[];
  custom_extensions?: CustomExtension[];
}

export type RelationshipCardinality = 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';

export interface OsiRelationship {
  name: string;
  from: string;
  to: string;
  from_columns: string[];
  to_columns: string[];
  cardinality?: RelationshipCardinality;
  notes?: string;
  ai_context?: string | AIContext;
  custom_extensions?: CustomExtension[];
}

export interface OsiMetric {
  name: string;
  expression: Expression;
  description?: string;
  ai_context?: string | AIContext;
  custom_extensions?: CustomExtension[];
}

export interface OsiSemanticModel {
  name: string;
  description?: string;
  ai_context?: string | AIContext;
  datasets: OsiDataset[];
  relationships?: OsiRelationship[];
  metrics?: OsiMetric[];
  custom_extensions?: CustomExtension[];
}

export interface OsiDocument {
  version: '1.0';
  dialects?: Dialect[];
  vendors?: Vendor[];
  semantic_model: OsiSemanticModel[];
}
