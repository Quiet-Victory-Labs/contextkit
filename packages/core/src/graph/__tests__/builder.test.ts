import { describe, it, expect } from 'vitest';
import { createEmptyGraph, buildGraph } from '../builder.js';
import type { ContextNode, Owner, Product, Concept } from '../../types/index.js';

describe('createEmptyGraph', () => {
  it('creates a graph with empty collections', () => {
    const graph = createEmptyGraph();

    expect(graph.nodes.size).toBe(0);
    expect(graph.edges).toEqual([]);
    expect(graph.indexes.byKind.size).toBe(0);
    expect(graph.indexes.byOwner.size).toBe(0);
    expect(graph.indexes.byTag.size).toBe(0);
    expect(graph.indexes.byStatus.size).toBe(0);
    expect(graph.indexes.dependents.size).toBe(0);
  });
});

describe('buildGraph', () => {
  it('builds a graph from an array of nodes', () => {
    const owner: Owner = {
      id: 'finance-team',
      kind: 'owner',
      displayName: 'Finance Team',
      email: 'finance@acme.com',
      team: 'Finance',
      source: { file: 'owners/finance-team.owner.yaml', line: 1, col: 1 },
    };

    const product: Product = {
      id: 'revenue-reporting',
      kind: 'product',
      description: 'Official revenue reporting.',
      owner: 'finance-team',
      tags: ['finance'],
      source: { file: 'products/revenue-reporting.ctx.yaml', line: 1, col: 1 },
    };

    const conceptA: Concept = {
      id: 'gross-revenue',
      kind: 'concept',
      definition: 'Total invoiced revenue before refunds.',
      owner: 'finance-team',
      status: 'certified',
      tags: ['finance', 'metric'],
      productId: 'revenue-reporting',
      source: { file: 'concepts/gross-revenue.ctx.yaml', line: 1, col: 1 },
    };

    const conceptB: Concept = {
      id: 'net-revenue',
      kind: 'concept',
      definition: 'Revenue after refunds and adjustments.',
      owner: 'finance-team',
      status: 'draft',
      tags: ['finance', 'metric'],
      dependsOn: ['gross-revenue'],
      productId: 'revenue-reporting',
      source: { file: 'concepts/net-revenue.ctx.yaml', line: 1, col: 1 },
    };

    const nodes: ContextNode[] = [owner, product, conceptA, conceptB];
    const graph = buildGraph(nodes);

    // Verify node count
    expect(graph.nodes.size).toBe(4);
    expect(graph.nodes.has('finance-team')).toBe(true);
    expect(graph.nodes.has('revenue-reporting')).toBe(true);
    expect(graph.nodes.has('gross-revenue')).toBe(true);
    expect(graph.nodes.has('net-revenue')).toBe(true);

    // Verify byKind index
    expect(graph.indexes.byKind.get('owner')).toEqual(['finance-team']);
    expect(graph.indexes.byKind.get('product')).toEqual(['revenue-reporting']);
    expect(graph.indexes.byKind.get('concept')).toEqual(['gross-revenue', 'net-revenue']);

    // Verify byOwner index
    expect(graph.indexes.byOwner.get('finance-team')).toEqual([
      'revenue-reporting',
      'gross-revenue',
      'net-revenue',
    ]);

    // Verify byTag index
    expect(graph.indexes.byTag.get('finance')).toEqual([
      'revenue-reporting',
      'gross-revenue',
      'net-revenue',
    ]);
    expect(graph.indexes.byTag.get('metric')).toEqual(['gross-revenue', 'net-revenue']);

    // Verify byStatus index
    expect(graph.indexes.byStatus.get('certified')).toEqual(['gross-revenue']);
    expect(graph.indexes.byStatus.get('draft')).toEqual(['net-revenue']);

    // Verify edges
    const dependsOnEdges = graph.edges.filter(e => e.type === 'depends_on');
    expect(dependsOnEdges).toEqual([
      { from: 'net-revenue', to: 'gross-revenue', type: 'depends_on' },
    ]);

    const belongsToEdges = graph.edges.filter(e => e.type === 'belongs_to');
    expect(belongsToEdges).toEqual([
      { from: 'gross-revenue', to: 'revenue-reporting', type: 'belongs_to' },
      { from: 'net-revenue', to: 'revenue-reporting', type: 'belongs_to' },
    ]);

    const ownedByEdges = graph.edges.filter(e => e.type === 'owned_by');
    expect(ownedByEdges).toHaveLength(3); // product + 2 concepts

    // Verify dependents index
    expect(graph.indexes.dependents.get('gross-revenue')).toEqual(['net-revenue']);
  });
});
