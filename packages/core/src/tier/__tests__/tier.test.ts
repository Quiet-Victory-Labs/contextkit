import { describe, it, expect } from 'vitest';
import type {
  ContextGraph,
  OsiSemanticModel,
  GovernanceFile,
  RulesFile,
  LineageFile,
  TermFile,
  OwnerFile,
  TierScore,
} from '../../types/index.js';
import { createEmptyGraph } from '../../compiler/graph.js';
import { computeTier, computeAllTiers } from '../compute.js';
import { checkBronze, checkSilver, checkGold } from '../checks.js';

// ---------------------------------------------------------------------------
// Helper: build a fully-complete Gold-level graph for 'retail-sales'
// ---------------------------------------------------------------------------
function buildGoldGraph(): ContextGraph {
  const graph = createEmptyGraph();

  // Model
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
          {
            name: 'product_id',
            description: 'Foreign key to products table',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'product_id' }] },
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
      {
        name: 'products',
        source: 'warehouse.public.products',
        description: 'Product dimension table',
        fields: [
          {
            name: 'product_id',
            description: 'Unique product identifier',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'product_id' }] },
          },
          {
            name: 'product_name',
            description: 'Product display name',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'product_name' }] },
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
      {
        name: 'txn-to-product',
        from: 'transactions',
        to: 'products',
        from_columns: ['product_id'],
        to_columns: ['product_id'],
      },
      {
        name: 'customer-to-product',
        from: 'customers',
        to: 'products',
        from_columns: ['customer_id'],
        to_columns: ['product_id'],
        notes: 'Customer preferred product (illustrative join)',
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

  // Governance — full Gold-level
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
      products: { grain: 'One row per product', refresh: 'daily', table_type: 'dimension' },
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
      'transactions.txn_date': { semantic_role: 'date', sample_values: ['2024-01-01', '2024-06-15'] },
      'transactions.customer_id': { semantic_role: 'identifier' },
      'transactions.product_id': { semantic_role: 'identifier' },
      'customers.customer_id': { semantic_role: 'identifier' },
      'customers.region': {
        semantic_role: 'dimension',
        sample_values: ['NA', 'EMEA'],
      },
      'products.product_id': { semantic_role: 'identifier' },
      'products.product_name': { semantic_role: 'dimension', sample_values: ['Widget', 'Gadget'] },
    },
  };
  graph.governance.set('retail-sales', gov);
  graph.indexes.modelToGovernance.set('retail-sales', 'retail-sales');

  // Rules — full Gold-level
  const rules: RulesFile = {
    model: 'retail-sales',
    golden_queries: [
      { question: 'Q1?', sql: 'SELECT 1' },
      { question: 'Q2?', sql: 'SELECT 2' },
      { question: 'Q3?', sql: 'SELECT 3' },
    ],
    business_rules: [
      { name: 'rule1', definition: 'Always do X' },
    ],
    guardrail_filters: [
      { name: 'filter1', filter: 'amount > 0', reason: 'exclude negatives' },
    ],
    hierarchies: [
      { name: 'geography', levels: ['region'], dataset: 'customers' },
    ],
  };
  graph.rules.set('retail-sales', rules);
  graph.indexes.modelToRules.set('retail-sales', 'retail-sales');

  // Lineage — upstream
  const lineage: LineageFile = {
    model: 'retail-sales',
    upstream: [{ source: 'erp.orders', type: 'pipeline' }],
  };
  graph.lineage.set('retail-sales', lineage);
  graph.indexes.modelToLineage.set('retail-sales', 'retail-sales');

  // Owner
  const owner: OwnerFile = {
    id: 'analytics-team',
    display_name: 'Analytics Team',
    email: 'analytics@company.com',
  };
  graph.owners.set('analytics-team', owner);

  // Terms — overlap on tags/owner with governance
  const term: TermFile = {
    id: 'revenue',
    definition: 'Total value of completed transactions',
    tags: ['finance', 'kpi'],
    owner: 'analytics-team',
  };
  graph.terms.set('revenue', term);

  const term2: TermFile = {
    id: 'customer',
    definition: 'An individual or entity that purchases products or services',
    tags: ['finance'],
    owner: 'analytics-team',
  };
  graph.terms.set('customer', term2);

  const term3: TermFile = {
    id: 'transaction',
    definition: 'A single purchase event recording the exchange of goods for payment',
    tags: ['finance', 'revenue'],
    owner: 'analytics-team',
  };
  graph.terms.set('transaction', term3);

  // Populate indexes
  graph.indexes.byOwner.set('analytics-team', ['retail-sales']);
  graph.indexes.byTag.set('finance', ['retail-sales']);
  graph.indexes.byTag.set('revenue', ['retail-sales']);
  graph.indexes.byTag.set('kpi', ['retail-sales']);
  graph.indexes.byTrust.set('endorsed', ['retail-sales']);

  return graph;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Tier Computation Engine', () => {
  // ----------- Gold -----------
  describe('Gold tier', () => {
    it('a fully-complete model scores Gold', () => {
      const graph = buildGoldGraph();
      const score = computeTier('retail-sales', graph);

      expect(score.tier).toBe('gold');
      expect(score.bronze.passed).toBe(true);
      expect(score.silver.passed).toBe(true);
      expect(score.gold.passed).toBe(true);
      expect(score.model).toBe('retail-sales');
    });

    it('all Gold checks pass for a complete model', () => {
      const graph = buildGoldGraph();
      const checks = checkGold('retail-sales', graph);
      const failedChecks = checks.filter((c) => !c.passed);
      expect(failedChecks).toHaveLength(0);
    });
  });

  // ----------- Silver (not Gold) -----------
  describe('Silver tier', () => {
    it('a model missing semantic_role on a field scores Silver (not Gold)', () => {
      const graph = buildGoldGraph();
      // Remove semantic_role for one field by removing it from governance fields
      const gov = graph.governance.get('retail-sales')!;
      delete gov.fields!['customers.region'];

      const score = computeTier('retail-sales', graph);
      expect(score.tier).toBe('silver');
      expect(score.bronze.passed).toBe(true);
      expect(score.silver.passed).toBe(true);
      expect(score.gold.passed).toBe(false);
    });

    it('a model missing default_aggregation on a metric field scores Silver', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      // Remove default_aggregation from the metric field
      delete gov.fields!['transactions.amount']!.default_aggregation;

      const score = computeTier('retail-sales', graph);
      expect(score.tier).toBe('silver');
      expect(score.gold.passed).toBe(false);
    });

    it('all Silver checks pass for a Silver-level model', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      delete gov.fields!['customers.region'];

      const checks = checkSilver('retail-sales', graph);
      const failedChecks = checks.filter((c) => !c.passed);
      expect(failedChecks).toHaveLength(0);
    });
  });

  // ----------- Bronze (not Silver) -----------
  describe('Bronze tier', () => {
    it('a model missing trust status scores Bronze (not Silver)', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      delete gov.trust;

      const score = computeTier('retail-sales', graph);
      expect(score.tier).toBe('bronze');
      expect(score.bronze.passed).toBe(true);
      expect(score.silver.passed).toBe(false);
      expect(score.gold.passed).toBe(false);
    });

    it('a model missing upstream lineage scores Bronze', () => {
      const graph = buildGoldGraph();
      // Remove lineage entirely
      graph.lineage.delete('retail-sales');
      graph.indexes.modelToLineage.delete('retail-sales');

      const score = computeTier('retail-sales', graph);
      expect(score.tier).toBe('bronze');
      expect(score.silver.passed).toBe(false);
    });

    it('all Bronze checks pass for a Bronze-level model', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      delete gov.trust;

      const checks = checkBronze('retail-sales', graph);
      const failedChecks = checks.filter((c) => !c.passed);
      expect(failedChecks).toHaveLength(0);
    });
  });

  // ----------- None (not Bronze) -----------
  describe('None tier', () => {
    it('a model missing description scores None (not Bronze)', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      delete model.description;

      const score = computeTier('retail-sales', graph);
      expect(score.tier).toBe('none');
      expect(score.bronze.passed).toBe(false);
    });

    it('a model missing field descriptions scores None', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      // Remove description from a field
      delete model.datasets[0]!.fields![0]!.description;

      const score = computeTier('retail-sales', graph);
      expect(score.tier).toBe('none');
      expect(score.bronze.passed).toBe(false);
    });

    it('a model missing dataset description scores None', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      delete model.datasets[0]!.description;

      const score = computeTier('retail-sales', graph);
      expect(score.tier).toBe('none');
      expect(score.bronze.passed).toBe(false);
    });
  });

  // ----------- computeTier returns TierScore structure -----------
  describe('computeTier return shape', () => {
    it('returns a TierScore with detailed check results', () => {
      const graph = buildGoldGraph();
      const score = computeTier('retail-sales', graph);

      expect(score).toHaveProperty('model');
      expect(score).toHaveProperty('tier');
      expect(score).toHaveProperty('bronze');
      expect(score).toHaveProperty('silver');
      expect(score).toHaveProperty('gold');

      expect(Array.isArray(score.bronze.checks)).toBe(true);
      expect(Array.isArray(score.silver.checks)).toBe(true);
      expect(Array.isArray(score.gold.checks)).toBe(true);

      // Each check should have id, label, passed
      for (const check of [...score.bronze.checks, ...score.silver.checks, ...score.gold.checks]) {
        expect(check).toHaveProperty('id');
        expect(check).toHaveProperty('label');
        expect(typeof check.passed).toBe('boolean');
      }
    });

    it('bronze checks count is 7', () => {
      const graph = buildGoldGraph();
      const checks = checkBronze('retail-sales', graph);
      expect(checks).toHaveLength(7);
    });

    it('silver checks count is 6', () => {
      const graph = buildGoldGraph();
      const checks = checkSilver('retail-sales', graph);
      expect(checks).toHaveLength(6);
    });

    it('gold checks count is 24', () => {
      const graph = buildGoldGraph();
      const checks = checkGold('retail-sales', graph);
      expect(checks).toHaveLength(24);
    });
  });

  // ----------- Zero-field edge cases -----------
  describe('Zero-field edge cases', () => {
    it('model with empty fields arrays fails bronze/field-descriptions', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      // Set all datasets to have empty fields arrays
      for (const ds of model.datasets) {
        ds.fields = [];
      }

      const checks = checkBronze('retail-sales', graph);
      const fieldDesc = checks.find((c) => c.id === 'bronze/field-descriptions');
      expect(fieldDesc).toBeDefined();
      expect(fieldDesc!.passed).toBe(false);
      expect(fieldDesc!.detail).toBe('No fields defined across any dataset');
    });

    it('model with no fields fails gold/field-semantic-role', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      // Set all datasets to have empty fields arrays
      for (const ds of model.datasets) {
        ds.fields = [];
      }

      const checks = checkGold('retail-sales', graph);
      const semRole = checks.find((c) => c.id === 'gold/field-semantic-role');
      expect(semRole).toBeDefined();
      expect(semRole!.passed).toBe(false);
      expect(semRole!.detail).toBe('Model has no fields to verify');
    });

    it('model with no metric fields fails gold/metric-aggregation', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      // Remove the metric semantic_role so no metric fields exist
      for (const [, fg] of Object.entries(gov.fields!)) {
        if (fg.semantic_role === 'metric') {
          fg.semantic_role = 'dimension';
          delete fg.default_aggregation;
          delete fg.additive;
        }
      }

      const checks = checkGold('retail-sales', graph);
      const metricAgg = checks.find((c) => c.id === 'gold/metric-aggregation');
      expect(metricAgg).toBeDefined();
      expect(metricAgg!.passed).toBe(false);
      expect(metricAgg!.detail).toBe('No metric fields found');
    });

    it('model with no metric fields fails gold/metric-additive', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      // Remove the metric semantic_role so no metric fields exist
      for (const [, fg] of Object.entries(gov.fields!)) {
        if (fg.semantic_role === 'metric') {
          fg.semantic_role = 'dimension';
          delete fg.default_aggregation;
          delete fg.additive;
        }
      }

      const checks = checkGold('retail-sales', graph);
      const metricAdd = checks.find((c) => c.id === 'gold/metric-additive');
      expect(metricAdd).toBeDefined();
      expect(metricAdd!.passed).toBe(false);
      expect(metricAdd!.detail).toBe('No metric fields found');
    });
  });

  // ----------- New Gold checks (11-16) failure cases -----------
  describe('New Gold checks failure cases', () => {
    it('placeholder owner fails gold/owner-contactable', () => {
      const graph = buildGoldGraph();
      // Replace owner with a placeholder
      graph.owners.delete('analytics-team');
      const placeholder: OwnerFile = {
        id: 'default-team',
        display_name: 'Default Team',
        email: 'default@company.com',
      };
      graph.owners.set('default-team', placeholder);
      const gov = graph.governance.get('retail-sales')!;
      gov.owner = 'default-team';
      graph.indexes.byOwner.delete('analytics-team');
      graph.indexes.byOwner.set('default-team', ['retail-sales']);

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/owner-contactable');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('placeholder name');
    });

    it('owner without email fails gold/owner-contactable', () => {
      const graph = buildGoldGraph();
      const owner = graph.owners.get('analytics-team')!;
      delete owner.email;

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/owner-contactable');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('no email');
    });

    it('no relationships fails gold/relationships-defined', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      model.relationships = [];

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/relationships-defined');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('No relationships defined');
    });

    it('short description fails gold/model-description-quality', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      model.description = 'Short desc';

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/model-description-quality');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('10 chars');
    });

    it('no ai_context fails gold/ai-context-exists', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      delete model.ai_context;

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/ai-context-exists');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('No ai_context');
    });

    it('no business_context fails gold/business-context', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      delete gov.business_context;

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/business-context');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('No business_context');
    });

    it('business_context with TODO entries fails gold/business-context', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      gov.business_context = [
        { name: 'TODO: Fill in', description: 'TODO: Add description' },
      ];

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/business-context');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('TODO placeholders');
    });

    it('no version fails gold/model-version', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      delete gov.version;

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/model-version');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('No version');
    });

    it('lazy field descriptions fail gold/field-description-quality', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      // Set a field description to just the column name
      model.datasets[0]!.fields![0]!.description = 'txn_id';

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/field-description-quality');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('lazy descriptions');
    });

    it('placeholder glossary definition fails gold/glossary-definition-quality', () => {
      const graph = buildGoldGraph();
      const term = graph.terms.get('revenue')!;
      term.definition = 'Definition for revenue';

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/glossary-definition-quality');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('placeholder definitions');
    });

    it('self-referencing lineage fails gold/lineage-no-self-reference', () => {
      const graph = buildGoldGraph();
      const lineage = graph.lineage.get('retail-sales')!;
      lineage.upstream = [
        { source: 'transactions', type: 'pipeline', notes: 'Upstream source for transactions' },
      ];

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/lineage-no-self-reference');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('reference dataset names');
    });

    it('placeholder grain fails gold/grain-no-placeholder', () => {
      const graph = buildGoldGraph();
      const gov = graph.governance.get('retail-sales')!;
      gov.datasets!['transactions']!.grain = 'one row per record (no primary key detected)';

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/grain-no-placeholder');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('placeholder grain');
    });

    it('ai_context with TODO fails gold/ai-context-no-todo', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      model.ai_context = 'TODO: Describe how an AI agent should use this model';

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/ai-context-no-todo');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('TODO placeholder');
    });

    it('3+ datasets with <3 relationships fails gold/relationships-coverage', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      // Keep 3 datasets but reduce relationships to 2
      model.relationships = model.relationships!.slice(0, 2);

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/relationships-coverage');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('3 datasets');
      expect(check!.detail).toContain('2 relationships');
    });

    it('<3 datasets auto-passes gold/relationships-coverage', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      // Remove datasets to get below 3
      model.datasets = model.datasets.slice(0, 2);

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/relationships-coverage');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it('no metrics fails gold/metrics-defined', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      model.metrics = [];

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/metrics-defined');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('No computed metrics');
    });

    it('metrics with TODO fails gold/metrics-defined', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      model.metrics = [
        {
          name: 'TODO: add metric',
          expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'TODO' }] },
          description: 'TODO: fill in',
        },
      ];

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/metrics-defined');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('TODO placeholders');
    });

    it('5+ datasets with <3 glossary terms fails gold/glossary-coverage', () => {
      const graph = buildGoldGraph();
      const model = graph.models.get('retail-sales')!;
      // Add 2 more datasets to reach 5
      model.datasets.push(
        {
          name: 'orders',
          source: 'warehouse.public.orders',
          description: 'Orders aggregation table',
          fields: [
            {
              name: 'order_id',
              description: 'Unique order identifier',
              expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'order_id' }] },
            },
          ],
        },
        {
          name: 'regions',
          source: 'warehouse.public.regions',
          description: 'Region dimension table',
          fields: [
            {
              name: 'region_id',
              description: 'Unique region identifier',
              expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'region_id' }] },
            },
          ],
        },
      );
      // Remove 2 of the 3 glossary terms to leave only 1
      graph.terms.delete('customer');
      graph.terms.delete('transaction');

      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/glossary-coverage');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.detail).toContain('5 datasets');
      expect(check!.detail).toContain('1 glossary terms');
    });

    it('<5 datasets auto-passes gold/glossary-coverage', () => {
      const graph = buildGoldGraph();
      // buildGoldGraph has 3 datasets, which is < 5, so should auto-pass
      const checks = checkGold('retail-sales', graph);
      const check = checks.find((c) => c.id === 'gold/glossary-coverage');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });
  });

  // ----------- computeAllTiers -----------
  describe('computeAllTiers', () => {
    it('populates graph.tiers for all models', () => {
      const graph = buildGoldGraph();
      expect(graph.tiers.size).toBe(0);

      computeAllTiers(graph);

      expect(graph.tiers.size).toBe(1);
      expect(graph.tiers.has('retail-sales')).toBe(true);
      const score = graph.tiers.get('retail-sales')!;
      expect(score.tier).toBe('gold');
    });

    it('handles multiple models', () => {
      const graph = buildGoldGraph();

      // Add a second model with minimal metadata (None tier)
      const model2: OsiSemanticModel = {
        name: 'bare-model',
        datasets: [
          {
            name: 'ds1',
            source: 'src.ds1',
            fields: [
              {
                name: 'f1',
                expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'f1' }] },
              },
            ],
          },
        ],
      };
      graph.models.set('bare-model', model2);

      computeAllTiers(graph);

      expect(graph.tiers.size).toBe(2);
      expect(graph.tiers.get('retail-sales')!.tier).toBe('gold');
      expect(graph.tiers.get('bare-model')!.tier).toBe('none');
    });
  });
});
