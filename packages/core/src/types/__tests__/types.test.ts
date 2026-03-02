import { describe, it, expect } from 'vitest';
import type {
  Concept,
  Product,
  Policy,
  Diagnostic,
  Entity,
  Term,
  Owner,
  ContextNode,
  Edge,
  ContextGraph,
  ContextKitConfig,
  Manifest,
} from '../index.js';

describe('Core Types', () => {
  it('creates a valid Concept node', () => {
    const concept: Concept = {
      id: 'concept/churn-rate',
      kind: 'concept',
      source: { file: 'context/concepts/churn-rate.yaml', line: 1, col: 1 },
      definition: 'The percentage of customers who stop using a product over a given period.',
      owner: 'analytics-team',
      tags: ['metrics', 'retention'],
      status: 'certified',
      certified: true,
      dependsOn: ['concept/customer', 'concept/subscription'],
      examples: [
        { label: 'Correct usage', content: 'Monthly churn rate was 3%.', kind: 'do' },
        { label: 'Incorrect usage', content: 'Churn means any cancellation.', kind: 'dont' },
      ],
    };

    expect(concept.id).toBe('concept/churn-rate');
    expect(concept.kind).toBe('concept');
    expect(concept.definition).toContain('percentage');
    expect(concept.certified).toBe(true);
    expect(concept.examples).toHaveLength(2);
    expect(concept.dependsOn).toHaveLength(2);
    expect(concept.source.file).toContain('churn-rate');
  });

  it('creates a valid Product node', () => {
    const product: Product = {
      id: 'product/dashboard',
      kind: 'product',
      source: { file: 'context/products/dashboard.yaml', line: 1, col: 1 },
      description: 'Analytics dashboard for tracking key business metrics.',
      owner: 'product-team',
      tags: ['analytics'],
      status: 'certified',
    };

    expect(product.id).toBe('product/dashboard');
    expect(product.kind).toBe('product');
    expect(product.description).toContain('Analytics');
  });

  it('creates a valid Policy node with rules', () => {
    const policy: Policy = {
      id: 'policy/certified-only',
      kind: 'policy',
      source: { file: 'context/policies/certified-only.yaml', line: 1, col: 1 },
      description: 'Only certified concepts may be used in production.',
      rules: [
        {
          priority: 1,
          when: { status: 'draft' },
          then: { deny: true, warn: 'Draft concepts cannot be used in production.' },
        },
        {
          priority: 2,
          when: { tagsAny: ['deprecated'] },
          then: { warn: 'This concept is deprecated and should be replaced.' },
        },
      ],
    };

    expect(policy.id).toBe('policy/certified-only');
    expect(policy.kind).toBe('policy');
    expect(policy.rules).toHaveLength(2);
    expect(policy.rules[0]!.priority).toBe(1);
    expect(policy.rules[0]!.then.deny).toBe(true);
  });

  it('creates a valid Diagnostic', () => {
    const diagnostic: Diagnostic = {
      ruleId: 'no-undefined-refs',
      severity: 'error',
      message: 'Reference "concept/unknown" does not exist.',
      source: { file: 'context/concepts/churn-rate.yaml', line: 5, col: 12 },
      fixable: false,
      suggestions: ['Did you mean "concept/churn-rate"?'],
    };

    expect(diagnostic.ruleId).toBe('no-undefined-refs');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.fixable).toBe(false);
    expect(diagnostic.suggestions).toHaveLength(1);
    expect(diagnostic.fix).toBeUndefined();
  });

  it('creates a valid Entity node with fields', () => {
    const entity: Entity = {
      id: 'entity/user',
      kind: 'entity',
      source: { file: 'context/entities/user.yaml', line: 1, col: 1 },
      definition: 'A registered user in the system.',
      fields: [
        { name: 'email', description: 'Primary email address', type: 'string' },
        { name: 'plan', description: 'Subscription plan', type: 'string' },
      ],
    };

    expect(entity.kind).toBe('entity');
    expect(entity.fields).toHaveLength(2);
    expect(entity.fields![0]!.name).toBe('email');
  });

  it('creates a valid Term node', () => {
    const term: Term = {
      id: 'term/arr',
      kind: 'term',
      source: { file: 'context/terms/arr.yaml', line: 1, col: 1 },
      definition: 'Annual Recurring Revenue',
      synonyms: ['ARR', 'annual recurring revenue'],
      mapsTo: ['concept/revenue'],
    };

    expect(term.kind).toBe('term');
    expect(term.definition).toBe('Annual Recurring Revenue');
    expect(term.synonyms).toContain('ARR');
  });

  it('creates a valid Owner node', () => {
    const owner: Owner = {
      id: 'owner/analytics-team',
      kind: 'owner',
      source: { file: 'context/owners/analytics-team.yaml', line: 1, col: 1 },
      displayName: 'Analytics Team',
      email: 'analytics@example.com',
      team: 'data',
    };

    expect(owner.kind).toBe('owner');
    expect(owner.displayName).toBe('Analytics Team');
    expect(owner.email).toBe('analytics@example.com');
  });

  it('creates valid Edge and ContextGraph structures', () => {
    const concept: Concept = {
      id: 'concept/churn',
      kind: 'concept',
      source: { file: 'test.yaml', line: 1, col: 1 },
      definition: 'Customer churn rate.',
    };

    const product: Product = {
      id: 'product/dashboard',
      kind: 'product',
      source: { file: 'test.yaml', line: 1, col: 1 },
      description: 'Main dashboard.',
    };

    const edge: Edge = {
      from: 'concept/churn',
      to: 'product/dashboard',
      type: 'belongs_to',
    };

    const graph: ContextGraph = {
      nodes: new Map<string, ContextNode>([
        ['concept/churn', concept],
        ['product/dashboard', product],
      ]),
      edges: [edge],
      indexes: {
        byKind: new Map([['concept', ['concept/churn']], ['product', ['product/dashboard']]]),
        byOwner: new Map(),
        byTag: new Map(),
        byStatus: new Map(),
        dependents: new Map(),
      },
    };

    expect(graph.nodes.size).toBe(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.type).toBe('belongs_to');
    expect(graph.indexes.byKind.get('concept')).toEqual(['concept/churn']);
  });

  it('creates a valid ContextKitConfig', () => {
    const config: ContextKitConfig = {
      project: { id: 'my-project', displayName: 'My Project', version: '1.0.0' },
      paths: { rootDir: '.', contextDir: 'context', distDir: 'dist' },
      site: { enabled: true, title: 'My Docs', basePath: '/docs' },
      mcp: { enabled: true, transport: ['stdio', 'http'], http: { port: 3000 } },
      lint: { defaultSeverity: 'warning', rules: { 'no-undefined-refs': 'error', 'no-orphans': 'off' } },
    };

    expect(config.project.id).toBe('my-project');
    expect(config.paths?.contextDir).toBe('context');
    expect(config.mcp?.transport).toContain('stdio');
    expect(config.lint?.rules?.['no-undefined-refs']).toBe('error');
  });

  it('creates a valid Manifest', () => {
    const manifest: Manifest = {
      schemaVersion: '1.0',
      project: { id: 'test', displayName: 'Test', version: '1.0.0' },
      build: { timestamp: '2025-01-01T00:00:00Z', version: '0.1.0', nodeCount: 2 },
      concepts: [{ id: 'concept/churn', definition: 'Churn rate.' }],
      products: [{ id: 'product/app', description: 'Main app.' }],
      policies: [],
      entities: [],
      terms: [],
      owners: [],
      indexes: {
        byId: {
          'concept/churn': { kind: 'concept', index: 0 },
          'product/app': { kind: 'product', index: 0 },
        },
      },
    };

    expect(manifest.schemaVersion).toBe('1.0');
    expect(manifest.concepts).toHaveLength(1);
    expect(manifest.products).toHaveLength(1);
    expect(manifest.build.nodeCount).toBe(2);
    expect(manifest.indexes.byId['concept/churn']!.kind).toBe('concept');
  });

  it('supports fixable Diagnostic with Fix', () => {
    const diagnostic: Diagnostic = {
      ruleId: 'prefer-definition',
      severity: 'warning',
      message: 'Concept is missing a definition.',
      source: { file: 'context/concepts/test.yaml', line: 3, col: 1 },
      fixable: true,
      fix: {
        description: 'Add placeholder definition',
        edits: [
          {
            file: 'context/concepts/test.yaml',
            range: { startLine: 3, startCol: 1, endLine: 3, endCol: 1 },
            newText: 'definition: TODO\n',
          },
        ],
      },
    };

    expect(diagnostic.fixable).toBe(true);
    expect(diagnostic.fix?.edits).toHaveLength(1);
    expect(diagnostic.fix?.edits[0]!.newText).toContain('TODO');
  });
});
