export interface GoldenQuery {
  question: string;
  sql: string;
  dialect?: string;
  tags?: string[];
}

export interface BusinessRule {
  name: string;
  definition: string;
  enforcement?: string[];
  avoid?: string[];
  tables?: string[];
  applied_always?: boolean;
}

export interface GuardrailFilter {
  name: string;
  filter: string;
  tables?: string[];
  reason: string;
}

export interface Hierarchy {
  name: string;
  levels: string[];
  dataset: string;
  field?: string;
}

export interface RulesFile {
  model: string;
  golden_queries?: GoldenQuery[];
  business_rules?: BusinessRule[];
  guardrail_filters?: GuardrailFilter[];
  hierarchies?: Hierarchy[];
}
