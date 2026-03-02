import { describe, it, expect } from 'vitest';
import type { Manifest } from '@contextkit/core';

import { readManifest } from '../resources/manifest.js';
import { readConcept, listConcepts } from '../resources/concept.js';
import { readProduct, listProducts } from '../resources/product.js';
import { readPolicy, listPolicies } from '../resources/policy.js';
import { readGlossary } from '../resources/glossary.js';
import { searchContext } from '../tools/search.js';
import { explainNode } from '../tools/explain.js';
import { createContextMcpServer } from '../server.js';

/**
 * A mock manifest used across all tests.
 */
function createMockManifest(): Manifest {
  return {
    schemaVersion: '1.0',
    project: {
      id: 'test-project',
      displayName: 'Test Project',
      version: '1.0.0',
    },
    build: {
      timestamp: '2025-01-01T00:00:00Z',
      version: '1.0.0',
      nodeCount: 6,
    },
    concepts: [
      {
        id: 'annual-recurring-revenue',
        definition: 'The annualized value of recurring subscription revenue.',
        productId: 'billing-platform',
        owner: 'finance-team',
        tags: ['revenue', 'saas'],
        dependsOn: ['subscription'],
      },
      {
        id: 'subscription',
        definition: 'A recurring billing agreement with a customer.',
        productId: 'billing-platform',
        tags: ['billing'],
      },
    ],
    products: [
      {
        id: 'billing-platform',
        description: 'The core billing and invoicing system.',
        owner: 'finance-team',
        tags: ['billing', 'core'],
      },
    ],
    policies: [
      {
        id: 'data-retention',
        description: 'Data retention policy for billing records.',
        rules: [
          {
            priority: 1,
            when: { tagsAny: ['billing'] },
            then: { warn: 'Billing data must be retained for 7 years' },
          },
          {
            priority: 2,
            when: { conceptIds: ['annual-recurring-revenue'] },
            then: { requireRole: 'finance-admin' },
          },
        ],
        owner: 'compliance-team',
        tags: ['compliance'],
      },
    ],
    entities: [
      {
        id: 'invoice',
        definition: 'A bill sent to a customer for goods or services.',
        tags: ['billing'],
      },
    ],
    terms: [
      {
        id: 'arr',
        definition: 'Annual Recurring Revenue',
        synonyms: ['ARR'],
        mapsTo: ['annual-recurring-revenue'],
      },
      {
        id: 'mrr',
        definition: 'Monthly Recurring Revenue',
        synonyms: ['MRR'],
      },
    ],
    owners: [
      {
        id: 'finance-team',
        displayName: 'Finance Team',
        email: 'finance@example.com',
        team: 'Finance',
      },
      {
        id: 'compliance-team',
        displayName: 'Compliance Team',
        email: 'compliance@example.com',
        team: 'Legal',
      },
    ],
    indexes: {
      byId: {
        'annual-recurring-revenue': { kind: 'concept', index: 0 },
        'subscription': { kind: 'concept', index: 1 },
        'billing-platform': { kind: 'product', index: 0 },
        'data-retention': { kind: 'policy', index: 0 },
        'invoice': { kind: 'entity', index: 0 },
        'arr': { kind: 'term', index: 0 },
        'mrr': { kind: 'term', index: 1 },
        'finance-team': { kind: 'owner', index: 0 },
        'compliance-team': { kind: 'owner', index: 1 },
      },
    },
  };
}

// ── Resource Handler Tests ──────────────────────────────────────────

describe('readManifest', () => {
  it('returns the full manifest as JSON', () => {
    const manifest = createMockManifest();
    const result = readManifest(manifest);

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]!.uri).toBe('context://manifest');
    expect(result.contents[0]!.mimeType).toBe('application/json');

    const parsed = JSON.parse(result.contents[0]!.text as string);
    expect(parsed.project.id).toBe('test-project');
    expect(parsed.concepts).toHaveLength(2);
  });
});

describe('readConcept', () => {
  it('returns a concept by ID', () => {
    const manifest = createMockManifest();
    const result = readConcept(manifest, 'annual-recurring-revenue');

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]!.uri).toBe('context://concept/annual-recurring-revenue');

    const parsed = JSON.parse(result.contents[0]!.text as string);
    expect(parsed.id).toBe('annual-recurring-revenue');
    expect(parsed.definition).toContain('annualized');
  });

  it('returns an error for unknown ID', () => {
    const manifest = createMockManifest();
    const result = readConcept(manifest, 'nonexistent');

    const parsed = JSON.parse(result.contents[0]!.text as string);
    expect(parsed.error).toContain('not found');
  });
});

describe('listConcepts', () => {
  it('lists all concepts as resources', () => {
    const manifest = createMockManifest();
    const result = listConcepts(manifest);

    expect(result.resources).toHaveLength(2);
    expect(result.resources[0]!.uri).toBe('context://concept/annual-recurring-revenue');
    expect(result.resources[1]!.uri).toBe('context://concept/subscription');
  });
});

describe('readProduct', () => {
  it('returns a product by ID', () => {
    const manifest = createMockManifest();
    const result = readProduct(manifest, 'billing-platform');

    const parsed = JSON.parse(result.contents[0]!.text as string);
    expect(parsed.id).toBe('billing-platform');
    expect(parsed.description).toContain('billing');
  });

  it('returns an error for unknown ID', () => {
    const manifest = createMockManifest();
    const result = readProduct(manifest, 'nonexistent');

    const parsed = JSON.parse(result.contents[0]!.text as string);
    expect(parsed.error).toContain('not found');
  });
});

describe('listProducts', () => {
  it('lists all products as resources', () => {
    const manifest = createMockManifest();
    const result = listProducts(manifest);

    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]!.uri).toBe('context://product/billing-platform');
  });
});

describe('readPolicy', () => {
  it('returns a policy by ID', () => {
    const manifest = createMockManifest();
    const result = readPolicy(manifest, 'data-retention');

    const parsed = JSON.parse(result.contents[0]!.text as string);
    expect(parsed.id).toBe('data-retention');
    expect(parsed.rules).toHaveLength(2);
  });

  it('returns an error for unknown ID', () => {
    const manifest = createMockManifest();
    const result = readPolicy(manifest, 'nonexistent');

    const parsed = JSON.parse(result.contents[0]!.text as string);
    expect(parsed.error).toContain('not found');
  });
});

describe('listPolicies', () => {
  it('lists all policies as resources', () => {
    const manifest = createMockManifest();
    const result = listPolicies(manifest);

    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]!.uri).toBe('context://policy/data-retention');
  });
});

describe('readGlossary', () => {
  it('returns all terms as a glossary', () => {
    const manifest = createMockManifest();
    const result = readGlossary(manifest);

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]!.uri).toBe('context://glossary');

    const parsed = JSON.parse(result.contents[0]!.text as string);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('arr');
    expect(parsed[0].definition).toBe('Annual Recurring Revenue');
    expect(parsed[0].synonyms).toEqual(['ARR']);
  });
});

// ── Tool Handler Tests ──────────────────────────────────────────────

describe('searchContext', () => {
  it('matches on ID substring', () => {
    const manifest = createMockManifest();
    const result = searchContext(manifest, 'subscription');

    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.resultCount).toBeGreaterThanOrEqual(1);
    const ids = parsed.results.map((r: { id: string }) => r.id);
    expect(ids).toContain('subscription');
  });

  it('matches case-insensitively on definition', () => {
    const manifest = createMockManifest();
    const result = searchContext(manifest, 'ANNUALIZED');

    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.resultCount).toBeGreaterThanOrEqual(1);
    const ids = parsed.results.map((r: { id: string }) => r.id);
    expect(ids).toContain('annual-recurring-revenue');
  });

  it('matches on tags', () => {
    const manifest = createMockManifest();
    const result = searchContext(manifest, 'saas');

    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.resultCount).toBeGreaterThanOrEqual(1);
    const ids = parsed.results.map((r: { id: string }) => r.id);
    expect(ids).toContain('annual-recurring-revenue');
  });

  it('matches across multiple node types', () => {
    const manifest = createMockManifest();
    const result = searchContext(manifest, 'billing');

    const parsed = JSON.parse(result.content[0]!.text as string);
    // Should match: subscription (tag:billing), billing-platform (id & tags),
    // data-retention (description), invoice (tag:billing)
    expect(parsed.resultCount).toBeGreaterThanOrEqual(3);
    const kinds = [...new Set(parsed.results.map((r: { kind: string }) => r.kind))];
    expect(kinds.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty results for no match', () => {
    const manifest = createMockManifest();
    const result = searchContext(manifest, 'zzzznotfound');

    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.resultCount).toBe(0);
    expect(parsed.results).toEqual([]);
  });
});

describe('explainNode', () => {
  it('returns comprehensive info for a concept', () => {
    const manifest = createMockManifest();
    const result = explainNode(manifest, 'annual-recurring-revenue');

    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.kind).toBe('concept');
    expect(parsed.node.id).toBe('annual-recurring-revenue');

    // Dependencies
    expect(parsed.dependencies).toHaveLength(1);
    expect(parsed.dependencies[0].id).toBe('subscription');

    // Owner info
    expect(parsed.owner).not.toBeNull();
    expect(parsed.owner.id).toBe('finance-team');

    // Applicable policies (data-retention targets this concept by conceptIds)
    expect(parsed.applicablePolicies.length).toBeGreaterThanOrEqual(1);
    expect(parsed.applicablePolicies[0].id).toBe('data-retention');
  });

  it('finds dependents (concepts that depend on this node)', () => {
    const manifest = createMockManifest();
    const result = explainNode(manifest, 'subscription');

    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.kind).toBe('concept');
    expect(parsed.dependents).toHaveLength(1);
    expect(parsed.dependents[0].id).toBe('annual-recurring-revenue');
  });

  it('finds applicable policies by tag matching', () => {
    const manifest = createMockManifest();
    // subscription has tag 'billing', and data-retention policy has tagsAny: ['billing']
    const result = explainNode(manifest, 'subscription');

    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.applicablePolicies.length).toBeGreaterThanOrEqual(1);
    expect(parsed.applicablePolicies[0].id).toBe('data-retention');
  });

  it('returns error for unknown ID', () => {
    const manifest = createMockManifest();
    const result = explainNode(manifest, 'nonexistent');

    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.error).toContain('not found');
  });

  it('explains owner nodes', () => {
    const manifest = createMockManifest();
    const result = explainNode(manifest, 'finance-team');

    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.kind).toBe('owner');
    expect(parsed.node.displayName).toBe('Finance Team');
  });
});

// ── Server Factory Test ─────────────────────────────────────────────

describe('createContextMcpServer', () => {
  it('creates an McpServer without throwing', () => {
    const manifest = createMockManifest();
    const server = createContextMcpServer(manifest);

    expect(server).toBeDefined();
    // The server object should have a connect method
    expect(typeof server.connect).toBe('function');
  });
});
