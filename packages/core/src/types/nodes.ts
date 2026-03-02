export type NodeKind = 'concept' | 'entity' | 'policy' | 'term' | 'owner' | 'product';
export type Status = 'draft' | 'certified' | 'deprecated';
export type Severity = 'error' | 'warning';

export interface SourceLocation {
  file: string;
  line: number;
  col: number;
}

export interface Evidence {
  type: string;
  ref: string;
}

export interface Example {
  label: string;
  content: string;
  kind: 'do' | 'dont';
}

export interface BaseNode {
  id: string;
  kind: NodeKind;
  source: SourceLocation;
  owner?: string;
  tags?: string[];
  status?: Status;
  description?: string;
}

export interface Concept extends BaseNode {
  kind: 'concept';
  productId?: string;
  definition: string;
  certified?: boolean;
  evidence?: Evidence[];
  dependsOn?: string[];
  examples?: Example[];
}

export interface Product extends BaseNode {
  kind: 'product';
  description: string;
}

export interface Entity extends BaseNode {
  kind: 'entity';
  definition?: string;
  fields?: EntityField[];
}

export interface EntityField {
  name: string;
  description?: string;
  type?: string;
}

export interface PolicyRule {
  priority: number;
  when: { tagsAny?: string[]; conceptIds?: string[]; status?: Status };
  then: { requireRole?: string; deny?: boolean; warn?: string };
}

export interface Policy extends BaseNode {
  kind: 'policy';
  description: string;
  rules: PolicyRule[];
}

export interface Term extends BaseNode {
  kind: 'term';
  definition: string;
  synonyms?: string[];
  mapsTo?: string[];
}

export interface Owner extends BaseNode {
  kind: 'owner';
  displayName: string;
  email?: string;
  team?: string;
}

export type ContextNode = Concept | Product | Entity | Policy | Term | Owner;

export interface Edge {
  from: string;
  to: string;
  type: 'depends_on' | 'relates_to' | 'applies_to' | 'maps_to' | 'owned_by' | 'belongs_to';
}

export interface ContextGraph {
  nodes: Map<string, ContextNode>;
  edges: Edge[];
  indexes: {
    byKind: Map<NodeKind, string[]>;
    byOwner: Map<string, string[]>;
    byTag: Map<string, string[]>;
    byStatus: Map<string, string[]>;
    dependents: Map<string, string[]>;
  };
}
