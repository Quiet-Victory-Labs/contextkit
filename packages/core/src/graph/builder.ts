import type {
  ContextGraph,
  ContextNode,
  Edge,
  NodeKind,
  Concept,
  Term,
} from '../types/index.js';

/**
 * Create an empty ContextGraph with initialized (but empty) collections.
 */
export function createEmptyGraph(): ContextGraph {
  return {
    nodes: new Map<string, ContextNode>(),
    edges: [],
    indexes: {
      byKind: new Map<NodeKind, string[]>(),
      byOwner: new Map<string, string[]>(),
      byTag: new Map<string, string[]>(),
      byStatus: new Map<string, string[]>(),
      dependents: new Map<string, string[]>(),
    },
  };
}

/**
 * Build a full ContextGraph from an array of ContextNodes.
 *
 * Populates:
 *  - nodes Map (keyed by id)
 *  - indexes: byKind, byOwner, byTag, byStatus, dependents
 *  - edges: depends_on, belongs_to, owned_by, maps_to
 */
export function buildGraph(nodes: ContextNode[]): ContextGraph {
  const graph = createEmptyGraph();

  // ---- 1. Add all nodes to the Map ----
  for (const node of nodes) {
    graph.nodes.set(node.id, node);
  }

  // ---- 2. Build indexes ----
  for (const node of nodes) {
    // byKind
    appendIndex(graph.indexes.byKind, node.kind, node.id);

    // byOwner
    if (node.owner) {
      appendIndex(graph.indexes.byOwner, node.owner, node.id);
    }

    // byTag
    if (node.tags) {
      for (const tag of node.tags) {
        appendIndex(graph.indexes.byTag, tag, node.id);
      }
    }

    // byStatus
    if (node.status) {
      appendIndex(graph.indexes.byStatus, node.status, node.id);
    }
  }

  // ---- 3. Create edges ----
  for (const node of nodes) {
    // owned_by edges
    if (node.owner) {
      graph.edges.push({ from: node.id, to: node.owner, type: 'owned_by' });
    }

    if (node.kind === 'concept') {
      const concept = node as Concept;

      // depends_on edges + populate dependents index
      if (concept.dependsOn) {
        for (const dep of concept.dependsOn) {
          graph.edges.push({ from: concept.id, to: dep, type: 'depends_on' });
          appendIndex(graph.indexes.dependents, dep, concept.id);
        }
      }

      // belongs_to edge (concept → product)
      if (concept.productId) {
        graph.edges.push({ from: concept.id, to: concept.productId, type: 'belongs_to' });
      }
    }

    if (node.kind === 'term') {
      const term = node as Term;

      // maps_to edges
      if (term.mapsTo) {
        for (const target of term.mapsTo) {
          graph.edges.push({ from: term.id, to: target, type: 'maps_to' });
        }
      }
    }
  }

  return graph;
}

// ---- Helpers ----

function appendIndex<K>(map: Map<K, string[]>, key: K, value: string): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}
