import { execFileSync } from 'node:child_process';
import type {
  ContextGraph,
  ContextKitConfig,
  Manifest,
  ManifestConcept,
  ManifestProduct,
  ManifestPolicy,
  ManifestEntity,
  ManifestTerm,
  ManifestOwner,
  Concept,
  Product,
  Policy,
  Entity,
  Term,
  Owner,
} from '../types/index.js';

/**
 * Get the short git HEAD revision, or 'unknown' if not in a git repo.
 */
function getGitRevision(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Serialize a ContextGraph into the Manifest JSON format.
 */
export function emitManifest(graph: ContextGraph, config: ContextKitConfig): Manifest {
  const concepts: ManifestConcept[] = [];
  const products: ManifestProduct[] = [];
  const policies: ManifestPolicy[] = [];
  const entities: ManifestEntity[] = [];
  const terms: ManifestTerm[] = [];
  const owners: ManifestOwner[] = [];

  const byId: Record<string, { kind: string; index: number }> = {};

  for (const node of graph.nodes.values()) {
    switch (node.kind) {
      case 'concept': {
        const c = node as Concept;
        byId[c.id] = { kind: 'concept', index: concepts.length };
        concepts.push({
          id: c.id,
          definition: c.definition,
          productId: c.productId,
          certified: c.certified,
          owner: c.owner,
          tags: c.tags,
          dependsOn: c.dependsOn,
        });
        break;
      }
      case 'product': {
        const p = node as Product;
        byId[p.id] = { kind: 'product', index: products.length };
        products.push({
          id: p.id,
          description: p.description,
          owner: p.owner,
          tags: p.tags,
        });
        break;
      }
      case 'policy': {
        const p = node as Policy;
        byId[p.id] = { kind: 'policy', index: policies.length };
        policies.push({
          id: p.id,
          description: p.description,
          rules: p.rules,
          owner: p.owner,
          tags: p.tags,
        });
        break;
      }
      case 'entity': {
        const e = node as Entity;
        byId[e.id] = { kind: 'entity', index: entities.length };
        entities.push({
          id: e.id,
          definition: e.definition,
          fields: e.fields,
          owner: e.owner,
          tags: e.tags,
        });
        break;
      }
      case 'term': {
        const t = node as Term;
        byId[t.id] = { kind: 'term', index: terms.length };
        terms.push({
          id: t.id,
          definition: t.definition,
          synonyms: t.synonyms,
          mapsTo: t.mapsTo,
          owner: t.owner,
          tags: t.tags,
        });
        break;
      }
      case 'owner': {
        const o = node as Owner;
        byId[o.id] = { kind: 'owner', index: owners.length };
        owners.push({
          id: o.id,
          displayName: o.displayName,
          email: o.email,
          team: o.team,
        });
        break;
      }
    }
  }

  return {
    schemaVersion: '1.0.0',
    project: {
      id: config.project.id,
      displayName: config.project.displayName,
      version: config.project.version,
    },
    build: {
      timestamp: new Date().toISOString(),
      version: getGitRevision(),
      nodeCount: graph.nodes.size,
    },
    concepts,
    products,
    policies,
    entities,
    terms,
    owners,
    indexes: { byId },
  };
}
