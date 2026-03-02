import type { Concept, Product, Policy, Entity, Term, Owner } from './nodes.js';

export interface ManifestBuild {
  timestamp: string;
  version: string;
  nodeCount: number;
}

export interface ManifestProject {
  id: string;
  displayName: string;
  version: string;
}

export interface ManifestConcept {
  id: string;
  definition: string;
  productId?: string;
  certified?: boolean;
  owner?: string;
  tags?: string[];
  dependsOn?: string[];
}

export interface ManifestProduct {
  id: string;
  description: string;
  owner?: string;
  tags?: string[];
}

export interface ManifestPolicy {
  id: string;
  description: string;
  rules: Policy['rules'];
  owner?: string;
  tags?: string[];
}

export interface ManifestEntity {
  id: string;
  definition?: string;
  fields?: Entity['fields'];
  owner?: string;
  tags?: string[];
}

export interface ManifestTerm {
  id: string;
  definition: string;
  synonyms?: string[];
  mapsTo?: string[];
  owner?: string;
  tags?: string[];
}

export interface ManifestOwner {
  id: string;
  displayName: string;
  email?: string;
  team?: string;
}

export interface Manifest {
  schemaVersion: string;
  project: ManifestProject;
  build: ManifestBuild;
  concepts: ManifestConcept[];
  products: ManifestProduct[];
  policies: ManifestPolicy[];
  entities: ManifestEntity[];
  terms: ManifestTerm[];
  owners: ManifestOwner[];
  indexes: {
    byId: Record<string, { kind: string; index: number }>;
  };
}
