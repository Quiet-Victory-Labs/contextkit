import { describe, it, expect } from 'vitest';
import type {
  Manifest,
  OsiSemanticModel,
  GovernanceFile,
  RulesFile,
  LineageFile,
  TermFile,
  OwnerFile,
  TierScore,
} from '@runcontext/core';
import { generateSite } from '../generator.js';
import { buildSearchIndex } from '../search/build-index.js';

// ---------------------------------------------------------------------------
// Test manifest builder
// ---------------------------------------------------------------------------

function createTestManifest(overrides?: Partial<Manifest>): Manifest {
  const model: OsiSemanticModel = {
    name: 'sales',
    description: 'Sales semantic model',
    datasets: [
      {
        name: 'orders',
        source: 'db.public.orders',
        description: 'Order records',
        fields: [
          {
            name: 'order_id',
            description: 'Primary key',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'order_id' }] },
          },
          {
            name: 'amount',
            description: 'Order amount',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'amount' }] },
          },
        ],
      },
      {
        name: 'customers',
        source: 'db.public.customers',
        description: 'Customer dimension',
        fields: [
          {
            name: 'customer_id',
            description: 'Customer identifier',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'customer_id' }] },
          },
        ],
      },
    ],
    relationships: [
      {
        name: 'orders_to_customers',
        from: 'orders',
        to: 'customers',
        from_columns: ['customer_id'],
        to_columns: ['customer_id'],
      },
    ],
    metrics: [
      {
        name: 'total_revenue',
        description: 'Sum of all order amounts',
        expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'SUM(amount)' }] },
      },
    ],
  };

  const gov: GovernanceFile = {
    model: 'sales',
    owner: 'data-team',
    trust: 'endorsed',
    security: 'internal',
    tags: ['revenue', 'finance'],
    datasets: {
      orders: { grain: 'one row per order', table_type: 'fact', refresh: 'daily' },
    },
    fields: {
      'orders.order_id': { semantic_role: 'identifier' },
      'orders.amount': { semantic_role: 'metric', default_aggregation: 'SUM', additive: true },
    },
  };

  const rules: RulesFile = {
    model: 'sales',
    golden_queries: [
      { question: 'What is total revenue?', sql: 'SELECT SUM(amount) FROM orders', dialect: 'ANSI_SQL' },
      { question: 'How many orders?', sql: 'SELECT COUNT(*) FROM orders' },
    ],
    business_rules: [
      { name: 'Revenue calculation', definition: 'Revenue = SUM of amount from completed orders' },
    ],
    guardrail_filters: [
      { name: 'Active only', filter: "status = 'active'", tables: ['orders'], reason: 'Exclude cancelled' },
    ],
  };

  const lineage: LineageFile = {
    model: 'sales',
    upstream: [{ source: 'erp.orders', type: 'pipeline', tool: 'dbt' }],
    downstream: [{ target: 'dashboard.revenue', type: 'dashboard', tool: 'Tableau' }],
  };

  const term: TermFile = {
    id: 'revenue',
    definition: 'Total income from sales of goods or services',
    synonyms: ['sales', 'income'],
    maps_to: ['orders.amount'],
    owner: 'data-team',
    tags: ['finance'],
  };

  const anotherTerm: TermFile = {
    id: 'aov',
    definition: 'Average order value',
    owner: 'data-team',
  };

  const owner: OwnerFile = {
    id: 'data-team',
    display_name: 'Data Team',
    email: 'data@company.com',
    team: 'Engineering',
    description: 'Central data team',
  };

  const tierScore: TierScore = {
    model: 'sales',
    tier: 'silver',
    bronze: { passed: true, checks: [{ id: 'b1', label: 'Has description', passed: true }] },
    silver: { passed: true, checks: [{ id: 's1', label: 'Has governance', passed: true }] },
    gold: { passed: false, checks: [{ id: 'g1', label: 'All fields have roles', passed: false, detail: '1 of 2 fields' }] },
  };

  return {
    version: '0.2.0',
    generatedAt: new Date().toISOString(),
    models: { sales: model },
    governance: { sales: gov },
    rules: { sales: rules },
    lineage: { sales: lineage },
    terms: { revenue: term, aov: anotherTerm },
    owners: { 'data-team': owner },
    tiers: { sales: tierScore },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateSite', () => {
  it('produces expected file structure', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest);
    const paths = Array.from(files.keys()).sort();

    expect(paths).toContain('index.html');
    expect(paths).toContain('glossary.html');
    expect(paths).toContain('search.html');
    expect(paths).toContain('search-index.json');
    expect(paths).toContain('models/sales.html');
    expect(paths).toContain('models/sales/schema.html');
    expect(paths).toContain('models/sales/rules.html');
    expect(paths).toContain('owners/data-team.html');
  });

  it('model pages include tier badge', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest);
    const modelPage = files.get('models/sales.html')!;

    // Should contain the tier badge with 'silver' using tag-silver class
    expect(modelPage).toContain('silver');
    expect(modelPage).toContain('tag-silver');
    expect(modelPage).toMatch(/silver/i);
  });

  it('index page includes tier badges for models', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest);
    const indexPage = files.get('index.html')!;

    expect(indexPage).toContain('sales');
    expect(indexPage).toContain('silver');
    expect(indexPage).toContain('Sales semantic model');
  });

  it('schema browser page lists datasets and fields', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest);
    const schemaPage = files.get('models/sales/schema.html')!;

    // Should list datasets
    expect(schemaPage).toContain('orders');
    expect(schemaPage).toContain('customers');
    // Should list fields
    expect(schemaPage).toContain('order_id');
    expect(schemaPage).toContain('amount');
    expect(schemaPage).toContain('customer_id');
    // Should show semantic role from governance
    expect(schemaPage).toContain('identifier');
    expect(schemaPage).toContain('metric');
    // Should show default aggregation
    expect(schemaPage).toContain('SUM');
  });

  it('schema browser shows dataset governance metadata', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest);
    const schemaPage = files.get('models/sales/schema.html')!;

    expect(schemaPage).toContain('one row per order');
    expect(schemaPage).toContain('fact');
    expect(schemaPage).toContain('daily');
  });

  it('golden query gallery page exists and has queries', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest);
    const rulesPage = files.get('models/sales/rules.html')!;

    expect(rulesPage).toContain('Golden Queries');
    expect(rulesPage).toContain('What is total revenue?');
    expect(rulesPage).toContain('SELECT SUM(amount) FROM orders');
    expect(rulesPage).toContain('How many orders?');
  });

  it('rules page shows business rules and guardrails', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest);
    const rulesPage = files.get('models/sales/rules.html')!;

    expect(rulesPage).toContain('Business Rules');
    expect(rulesPage).toContain('Revenue calculation');
    expect(rulesPage).toContain('Guardrail Filters');
    expect(rulesPage).toContain('Active only');
    expect(rulesPage).toContain("status = &#39;active&#39;");
  });

  it('glossary page lists all terms alphabetically', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest);
    const glossaryPage = files.get('glossary.html')!;

    expect(glossaryPage).toContain('Glossary');
    expect(glossaryPage).toContain('revenue');
    expect(glossaryPage).toContain('Total income from sales');
    expect(glossaryPage).toContain('aov');
    expect(glossaryPage).toContain('Average order value');
    // aov should come before revenue alphabetically
    const aovPos = glossaryPage.indexOf('id="term-aov"');
    const revPos = glossaryPage.indexOf('id="term-revenue"');
    expect(aovPos).toBeLessThan(revPos);
  });

  it('owner page shows governed models with tier badges', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest);
    const ownerPage = files.get('owners/data-team.html')!;

    expect(ownerPage).toContain('Data Team');
    expect(ownerPage).toContain('data@company.com');
    expect(ownerPage).toContain('Engineering');
    expect(ownerPage).toContain('Governed Models');
    expect(ownerPage).toContain('sales');
    expect(ownerPage).toContain('silver');
  });

  it('respects custom site config (title and base_path)', () => {
    const manifest = createTestManifest();
    const files = generateSite(manifest, { title: 'My Docs', base_path: '/docs' });
    const indexPage = files.get('index.html')!;

    expect(indexPage).toContain('My Docs');
    expect(indexPage).toContain('/docs/models/sales.html');
    expect(indexPage).toContain('/docs/glossary.html');
  });

  it('handles empty manifest gracefully', () => {
    const manifest: Manifest = {
      version: '0.2.0',
      generatedAt: new Date().toISOString(),
      models: {},
      governance: {},
      rules: {},
      lineage: {},
      terms: {},
      owners: {},
      tiers: {},
    };
    const files = generateSite(manifest);

    expect(files.has('index.html')).toBe(true);
    expect(files.has('glossary.html')).toBe(true);
    expect(files.has('search.html')).toBe(true);
    // No model/owner pages should be generated
    const paths = Array.from(files.keys());
    expect(paths.filter((p) => p.startsWith('models/'))).toHaveLength(0);
    expect(paths.filter((p) => p.startsWith('owners/'))).toHaveLength(0);
  });
});

describe('buildSearchIndex', () => {
  it('includes models in the search index', () => {
    const manifest = createTestManifest();
    const index = buildSearchIndex(manifest, '');

    const docs = Object.values(index.documents);
    const modelDocs = docs.filter((d) => d.type === 'model');
    expect(modelDocs.length).toBeGreaterThanOrEqual(1);
    expect(modelDocs.some((d) => d.title === 'sales')).toBe(true);
  });

  it('includes datasets in the search index', () => {
    const manifest = createTestManifest();
    const index = buildSearchIndex(manifest, '');

    const docs = Object.values(index.documents);
    const datasetDocs = docs.filter((d) => d.type === 'dataset');
    expect(datasetDocs.length).toBeGreaterThanOrEqual(2);
    expect(datasetDocs.some((d) => d.title.includes('orders'))).toBe(true);
    expect(datasetDocs.some((d) => d.title.includes('customers'))).toBe(true);
  });

  it('includes terms in the search index', () => {
    const manifest = createTestManifest();
    const index = buildSearchIndex(manifest, '');

    const docs = Object.values(index.documents);
    const termDocs = docs.filter((d) => d.type === 'term');
    expect(termDocs.length).toBeGreaterThanOrEqual(2);
    expect(termDocs.some((d) => d.title === 'revenue')).toBe(true);
    expect(termDocs.some((d) => d.title === 'aov')).toBe(true);
  });

  it('includes owners in the search index', () => {
    const manifest = createTestManifest();
    const index = buildSearchIndex(manifest, '');

    const docs = Object.values(index.documents);
    const ownerDocs = docs.filter((d) => d.type === 'owner');
    expect(ownerDocs.length).toBeGreaterThanOrEqual(1);
    expect(ownerDocs.some((d) => d.title === 'Data Team')).toBe(true);
  });

  it('uses base_path in document URLs', () => {
    const manifest = createTestManifest();
    const index = buildSearchIndex(manifest, '/docs');

    const docs = Object.values(index.documents);
    const modelDoc = docs.find((d) => d.type === 'model' && d.title === 'sales');
    expect(modelDoc?.url).toBe('/docs/models/sales.html');
  });

  it('produces a valid serializable index', () => {
    const manifest = createTestManifest();
    const index = buildSearchIndex(manifest, '');

    // Should be JSON-serializable
    const json = JSON.stringify(index);
    const parsed = JSON.parse(json);
    expect(parsed.index).toBeDefined();
    expect(parsed.options).toBeDefined();
    expect(parsed.documents).toBeDefined();
    expect(parsed.options.fields).toEqual(['title', 'description', 'type']);
  });
});
