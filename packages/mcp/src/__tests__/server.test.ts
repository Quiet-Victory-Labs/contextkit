import { describe, it, expect, beforeAll } from 'vitest';
import type {
  Manifest,
  ContextGraph,
  OsiSemanticModel,
  GovernanceFile,
  RulesFile,
  LineageFile,
  TermFile,
  OwnerFile,
} from '@runcontext/core';
import { createEmptyGraph, emitManifest, computeAllTiers } from '@runcontext/core';

import { createServer } from '../server.js';
import { buildModelView } from '../resources/model.js';
import { searchManifest } from '../tools/search.js';
import { explainModel } from '../tools/explain.js';
import { validateGraph } from '../tools/validate.js';
import { computeModelTier } from '../tools/tier.js';
import { findGoldenQueries } from '../tools/golden-query.js';
import { findGuardrails } from '../tools/guardrails.js';

// ---------------------------------------------------------------------------
// Helper: build a gold-level test graph + manifest
// ---------------------------------------------------------------------------
function buildTestGraph(): ContextGraph {
  const graph = createEmptyGraph();

  const model: OsiSemanticModel = {
    name: 'retail-sales',
    description: 'Retail sales analytics model covering transactions, customers, and revenue KPIs for regional analysis',
    ai_context: 'Use this model for revenue analytics. Always filter amount > 0 for valid transactions.',
    datasets: [
      {
        name: 'transactions',
        source: 'warehouse.public.transactions',
        description: 'Sales transactions fact table',
        fields: [
          {
            name: 'txn_id',
            description: 'Unique transaction identifier',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'txn_id' }] },
          },
          {
            name: 'amount',
            description: 'Transaction amount in USD',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'amount' }] },
          },
          {
            name: 'txn_date',
            description: 'Transaction date',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'txn_date' }] },
          },
          {
            name: 'customer_id',
            description: 'Foreign key to customers table',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'customer_id' }] },
          },
        ],
      },
      {
        name: 'customers',
        source: 'warehouse.public.customers',
        description: 'Customer dimension table',
        fields: [
          {
            name: 'customer_id',
            description: 'Unique customer identifier',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'customer_id' }] },
          },
          {
            name: 'region',
            description: 'Customer region',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'region' }] },
          },
        ],
      },
    ],
    relationships: [
      {
        name: 'txn-to-customer',
        from: 'transactions',
        to: 'customers',
        from_columns: ['customer_id'],
        to_columns: ['customer_id'],
      },
    ],
    metrics: [
      {
        name: 'total_revenue',
        expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'SUM(transactions.amount)' }] },
        description: 'Total revenue across all transactions',
      },
    ],
  };
  graph.models.set('retail-sales', model);

  const gov: GovernanceFile = {
    model: 'retail-sales',
    owner: 'analytics-team',
    version: '1.0.0',
    trust: 'endorsed',
    security: 'internal',
    tags: ['finance', 'revenue', 'kpi'],
    business_context: [
      { name: 'Revenue Analysis', description: 'Track and analyze sales revenue by region and time period.' },
    ],
    datasets: {
      transactions: { grain: 'One row per transaction', refresh: 'daily', table_type: 'fact' },
      customers: { grain: 'One row per customer', refresh: 'hourly', table_type: 'dimension' },
    },
    fields: {
      'transactions.txn_id': { semantic_role: 'identifier' },
      'transactions.amount': {
        semantic_role: 'metric',
        default_aggregation: 'SUM',
        additive: true,
        default_filter: 'amount > 0',
        sample_values: ['10.00', '25.50'],
      },
      'transactions.txn_date': { semantic_role: 'date', sample_values: ['2024-01-01'] },
      'transactions.customer_id': { semantic_role: 'identifier' },
      'customers.customer_id': { semantic_role: 'identifier' },
      'customers.region': { semantic_role: 'dimension', sample_values: ['NA', 'EMEA'] },
    },
  };
  graph.governance.set('retail-sales', gov);
  graph.indexes.modelToGovernance.set('retail-sales', 'retail-sales');
  graph.indexes.byOwner.set('analytics-team', ['retail-sales']);
  graph.indexes.byTag.set('finance', ['retail-sales']);
  graph.indexes.byTag.set('revenue', ['retail-sales']);
  graph.indexes.byTag.set('kpi', ['retail-sales']);
  graph.indexes.byTrust.set('endorsed', ['retail-sales']);

  const rules: RulesFile = {
    model: 'retail-sales',
    golden_queries: [
      { question: 'What is the total revenue by region?', sql: 'SELECT region, SUM(amount) FROM transactions JOIN customers USING (customer_id) GROUP BY region' },
      { question: 'How many transactions per day?', sql: 'SELECT txn_date, COUNT(*) FROM transactions GROUP BY txn_date' },
      { question: 'What are top customers by spend?', sql: 'SELECT customer_id, SUM(amount) FROM transactions GROUP BY customer_id ORDER BY 2 DESC LIMIT 10' },
    ],
    business_rules: [
      { name: 'positive-amounts', definition: 'All transaction amounts must be positive', tables: ['transactions'] },
    ],
    guardrail_filters: [
      { name: 'positive-amount-filter', filter: 'amount > 0', tables: ['transactions'], reason: 'Exclude negative/zero amounts' },
      { name: 'active-customers', filter: 'status = active', reason: 'Only active customers' },
    ],
    hierarchies: [
      { name: 'geography', levels: ['region'], dataset: 'customers' },
    ],
  };
  graph.rules.set('retail-sales', rules);
  graph.indexes.modelToRules.set('retail-sales', 'retail-sales');

  const lineage: LineageFile = {
    model: 'retail-sales',
    upstream: [{ source: 'erp.orders', type: 'pipeline' }],
    downstream: [{ target: 'dashboard.sales-overview', type: 'dashboard' }],
  };
  graph.lineage.set('retail-sales', lineage);
  graph.indexes.modelToLineage.set('retail-sales', 'retail-sales');

  const owner: OwnerFile = {
    id: 'analytics-team',
    display_name: 'Analytics Team',
    email: 'analytics@company.com',
  };
  graph.owners.set('analytics-team', owner);

  const term: TermFile = {
    id: 'revenue',
    definition: 'Total value of completed transactions',
    synonyms: ['sales', 'income'],
    tags: ['finance', 'kpi'],
    owner: 'analytics-team',
  };
  graph.terms.set('revenue', term);

  const term2: TermFile = {
    id: 'customer',
    definition: 'An entity that purchases goods or services',
    synonyms: ['buyer', 'client'],
    tags: ['crm'],
  };
  graph.terms.set('customer', term2);

  computeAllTiers(graph);

  return graph;
}

function buildTestManifest(graph: ContextGraph): Manifest {
  return emitManifest(graph, {
    context_dir: './context',
    output_dir: './dist',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MCP Server', () => {
  let graph: ContextGraph;
  let manifest: Manifest;

  beforeAll(() => {
    graph = buildTestGraph();
    manifest = buildTestManifest(graph);
  });

  // ==========================================================================
  // Server creation
  // ==========================================================================
  describe('createServer', () => {
    it('creates a server instance successfully', () => {
      const server = createServer(manifest, graph);
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
    });

    it('exposes underlying Server instance', () => {
      const server = createServer(manifest, graph);
      // The McpServer wraps a Server — verify it is accessible
      expect(server.server).toBeDefined();
      expect(typeof server.connect).toBe('function');
      expect(typeof server.close).toBe('function');
    });
  });

  // ==========================================================================
  // Resources — tested via logic functions
  // ==========================================================================
  describe('Resource: manifest', () => {
    it('manifest contains models, governance, rules, lineage, terms, owners, tiers', () => {
      expect(manifest.models).toBeDefined();
      expect(manifest.governance).toBeDefined();
      expect(manifest.rules).toBeDefined();
      expect(manifest.lineage).toBeDefined();
      expect(manifest.terms).toBeDefined();
      expect(manifest.owners).toBeDefined();
      expect(manifest.tiers).toBeDefined();
    });

    it('manifest has version 0.3.5', () => {
      expect(manifest.version).toBe('0.5.0');
    });
  });

  describe('Resource: model', () => {
    it('buildModelView returns merged model data', () => {
      const view = buildModelView('retail-sales', manifest);
      expect(view).not.toBeNull();
      expect(view!.model).toBeDefined();
      expect(view!.governance).toBeDefined();
      expect(view!.rules).toBeDefined();
      expect(view!.lineage).toBeDefined();
      expect(view!.tier).toBeDefined();
    });

    it('buildModelView returns null for unknown model', () => {
      const view = buildModelView('unknown-model', manifest);
      expect(view).toBeNull();
    });
  });

  describe('Resource: glossary', () => {
    it('manifest terms contain the test terms', () => {
      expect(manifest.terms['revenue']).toBeDefined();
      expect(manifest.terms['revenue']!.definition).toBe('Total value of completed transactions');
      expect(manifest.terms['customer']).toBeDefined();
    });
  });

  describe('Resource: tier', () => {
    it('manifest tiers contain the retail-sales tier', () => {
      expect(manifest.tiers['retail-sales']).toBeDefined();
      expect(manifest.tiers['retail-sales']!.tier).toBe('gold');
    });
  });

  // ==========================================================================
  // Tools — tested via logic functions
  // ==========================================================================
  describe('Tool: context_search', () => {
    it('finds models by name', () => {
      const results = searchManifest(manifest, 'retail');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.type === 'model' && r.name === 'retail-sales')).toBe(true);
    });

    it('finds fields by name', () => {
      const results = searchManifest(manifest, 'amount');
      expect(results.some((r) => r.type === 'field' && r.name === 'amount')).toBe(true);
    });

    it('finds terms by definition', () => {
      const results = searchManifest(manifest, 'completed transactions');
      expect(results.some((r) => r.type === 'term' && r.name === 'revenue')).toBe(true);
    });

    it('finds terms by synonym', () => {
      const results = searchManifest(manifest, 'income');
      expect(results.some((r) => r.type === 'term' && r.name === 'revenue')).toBe(true);
    });

    it('finds owners by display name', () => {
      const results = searchManifest(manifest, 'Analytics');
      expect(results.some((r) => r.type === 'owner' && r.name === 'analytics-team')).toBe(true);
    });

    it('returns empty array for no matches', () => {
      const results = searchManifest(manifest, 'xyznonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('Tool: context_explain', () => {
    it('returns full explanation for an existing model', () => {
      const result = explainModel('retail-sales', manifest);
      expect(result).not.toBeNull();
      expect(result!.model).toBeDefined();
      expect(result!.governance).toBeDefined();
      expect(result!.rules).toBeDefined();
      expect(result!.lineage).toBeDefined();
      expect(result!.tier).toBeDefined();
      expect(result!.owner).toBeDefined();
    });

    it('includes related glossary terms', () => {
      const result = explainModel('retail-sales', manifest);
      expect(result!.relatedTerms.length).toBeGreaterThan(0);
      expect(result!.relatedTerms.some((t) => t['id'] === 'revenue')).toBe(true);
    });

    it('returns null for unknown model', () => {
      const result = explainModel('nonexistent', manifest);
      expect(result).toBeNull();
    });
  });

  describe('Tool: context_validate', () => {
    it('runs linter and returns diagnostics structure', () => {
      const result = validateGraph(graph);
      expect(result).toHaveProperty('totalDiagnostics');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('diagnostics');
      expect(typeof result.totalDiagnostics).toBe('number');
    });
  });

  describe('Tool: context_tier', () => {
    it('computes tier for an existing model', () => {
      const result = computeModelTier('retail-sales', graph);
      expect(result).not.toBeNull();
      expect(result!.model).toBe('retail-sales');
      expect(result!.tier).toBe('gold');
      expect(result!.bronze.passed).toBe(true);
      expect(result!.silver.passed).toBe(true);
      expect(result!.gold.passed).toBe(true);
    });

    it('returns null for unknown model', () => {
      const result = computeModelTier('nonexistent', graph);
      expect(result).toBeNull();
    });
  });

  describe('Tool: context_golden_query', () => {
    it('finds golden queries matching a question', () => {
      const results = findGoldenQueries(manifest, 'total revenue by region');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.model).toBe('retail-sales');
      expect(results[0]!.score).toBeGreaterThan(0);
    });

    it('returns empty for non-matching question', () => {
      const results = findGoldenQueries(manifest, 'xyz abc');
      expect(results).toHaveLength(0);
    });

    it('results are sorted by score descending', () => {
      const results = findGoldenQueries(manifest, 'transactions customers region');
      if (results.length >= 2) {
        expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
      }
    });
  });

  describe('Tool: context_guardrails', () => {
    it('finds guardrail filters for matching tables', () => {
      const results = findGuardrails(manifest, ['transactions']);
      // Should match 'positive-amount-filter' (table match) and 'active-customers' (no table restriction)
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((r) => r.filter.name === 'positive-amount-filter')).toBe(true);
      expect(results.some((r) => r.filter.name === 'active-customers')).toBe(true);
    });

    it('returns global guardrails even for unknown tables', () => {
      const results = findGuardrails(manifest, ['unknown-table']);
      // 'active-customers' has no tables restriction, so it applies globally
      expect(results.some((r) => r.filter.name === 'active-customers')).toBe(true);
    });

    it('returns all guardrails when given empty tables array', () => {
      // With empty tables, only global filters (no tables restriction) match
      const results = findGuardrails(manifest, []);
      expect(results.some((r) => r.filter.name === 'active-customers')).toBe(true);
    });
  });
});
