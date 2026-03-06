import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  compile,
  emitManifest,
  loadConfig,
  LintEngine,
  ALL_RULES,
  computeTier,
  computeAllTiers,
} from '../index.js';
import type { ContextGraph, Diagnostic } from '../types/index.js';
import type { Manifest } from '../compiler/emit.js';

const FIXTURES_VALID = path.resolve(__dirname, '../../../../fixtures/valid');
const FIXTURES_INVALID = path.resolve(__dirname, '../../../../fixtures/invalid');

// ---------------------------------------------------------------------------
// Shared helpers — compile once for the valid-fixtures suite
// ---------------------------------------------------------------------------

let validResult: { graph: ContextGraph; diagnostics: Diagnostic[] };

async function getValidResult() {
  if (!validResult) {
    validResult = await compile({ contextDir: FIXTURES_VALID });
  }
  return validResult;
}

// ---------------------------------------------------------------------------
// 1. Full compile of valid fixtures
// ---------------------------------------------------------------------------
describe('integration: full compile of valid fixtures', () => {
  it('produces no errors and a complete graph', async () => {
    const { graph, diagnostics } = await getValidResult();
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);

    // Graph should contain all six node types
    expect(graph.models.size).toBeGreaterThanOrEqual(1);
    expect(graph.governance.size).toBeGreaterThanOrEqual(1);
    expect(graph.rules.size).toBeGreaterThanOrEqual(1);
    expect(graph.lineage.size).toBeGreaterThanOrEqual(1);
    expect(graph.terms.size).toBeGreaterThanOrEqual(1);
    expect(graph.owners.size).toBeGreaterThanOrEqual(1);

    // Specific entries
    expect(graph.models.has('retail-sales')).toBe(true);
    expect(graph.governance.has('retail-sales')).toBe(true);
    expect(graph.rules.has('retail-sales')).toBe(true);
    expect(graph.lineage.has('retail-sales')).toBe(true);
    expect(graph.terms.has('revenue')).toBe(true);
    expect(graph.owners.has('analytics-team')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Tier computation on valid fixtures
// ---------------------------------------------------------------------------
describe('integration: tier computation', () => {
  it('computes Gold tier for the "retail-sales" model', async () => {
    const { graph } = await getValidResult();

    const score = computeTier('retail-sales', graph);
    expect(score.model).toBe('retail-sales');
    expect(score.tier).toBe('gold');

    // All three tier levels should pass
    expect(score.bronze.passed).toBe(true);
    expect(score.silver.passed).toBe(true);
    expect(score.gold.passed).toBe(true);

    // Every individual check within each tier should pass
    for (const check of score.bronze.checks) {
      expect(check.passed).toBe(true);
    }
    for (const check of score.silver.checks) {
      expect(check.passed).toBe(true);
    }
    for (const check of score.gold.checks) {
      expect(check.passed).toBe(true);
    }
  });

  it('populates graph.tiers via computeAllTiers during compile', async () => {
    const { graph } = await getValidResult();

    // compile() calls computeAllTiers internally
    expect(graph.tiers.size).toBeGreaterThanOrEqual(1);
    expect(graph.tiers.has('retail-sales')).toBe(true);
    expect(graph.tiers.get('retail-sales')!.tier).toBe('gold');
  });
});

// ---------------------------------------------------------------------------
// 3. Lint on valid fixtures
// ---------------------------------------------------------------------------
describe('integration: lint on valid fixtures', () => {
  it('produces 0 errors when running all rules', async () => {
    const { graph } = await getValidResult();

    const engine = new LintEngine();
    for (const rule of ALL_RULES) {
      engine.register(rule);
    }
    const diagnostics = engine.run(graph);
    const errors = diagnostics.filter((d) => d.severity === 'error');

    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Full compile of invalid fixtures
// ---------------------------------------------------------------------------
describe('integration: compile of invalid fixtures', () => {
  it('returns specific schema validation diagnostics', async () => {
    const { graph, diagnostics } = await compile({ contextDir: FIXTURES_INVALID });

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);

    // Should include schema/invalid diagnostics from the bad files
    const schemaErrors = errors.filter((d) => d.ruleId === 'schema/invalid');
    expect(schemaErrors.length).toBeGreaterThan(0);

    // The graph should have fewer entries because invalid files are skipped
    // bad-model.osi.yaml is missing 'version', so models may not include it
    // bad-governance.governance.yaml is missing 'model', so governance may not include it
    expect(graph.models.size + graph.governance.size).toBeLessThan(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Manifest emit
// ---------------------------------------------------------------------------
describe('integration: manifest emit', () => {
  it('produces valid JSON with all expected sections', async () => {
    const { graph } = await getValidResult();
    const config = loadConfig(FIXTURES_VALID);
    const manifest = emitManifest(graph, config);

    // Check manifest structure
    expect(manifest.version).toBe('0.3.5');
    expect(manifest.generatedAt).toBeDefined();
    expect(typeof manifest.generatedAt).toBe('string');

    // All seven sections should be present
    expect(manifest.models).toBeDefined();
    expect(manifest.governance).toBeDefined();
    expect(manifest.rules).toBeDefined();
    expect(manifest.lineage).toBeDefined();
    expect(manifest.terms).toBeDefined();
    expect(manifest.owners).toBeDefined();
    expect(manifest.tiers).toBeDefined();

    // Specific entries should be present in the manifest
    expect(manifest.models['retail-sales']).toBeDefined();
    expect(manifest.governance['retail-sales']).toBeDefined();
    expect(manifest.rules['retail-sales']).toBeDefined();
    expect(manifest.lineage['retail-sales']).toBeDefined();
    expect(manifest.terms['revenue']).toBeDefined();
    expect(manifest.owners['analytics-team']).toBeDefined();
    expect(manifest.tiers['retail-sales']).toBeDefined();
    expect(manifest.tiers['retail-sales']!.tier).toBe('gold');

    // JSON round-trip should succeed without errors
    const json = JSON.stringify(manifest);
    const parsed = JSON.parse(json) as Manifest;
    expect(parsed.version).toBe('0.3.5');
    expect(parsed.models['retail-sales']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Build + lint + tier as a single CLI-like flow
// ---------------------------------------------------------------------------
describe('integration: full CLI-like flow (compile -> lint -> tier -> emit)', () => {
  it('runs the complete pipeline without errors', async () => {
    // Step 1: Compile
    const { graph, diagnostics } = await compile({ contextDir: FIXTURES_VALID });
    const compileErrors = diagnostics.filter((d) => d.severity === 'error');
    expect(compileErrors).toHaveLength(0);

    // Step 2: Lint
    const engine = new LintEngine();
    for (const rule of ALL_RULES) {
      engine.register(rule);
    }
    const lintDiagnostics = engine.run(graph);
    const lintErrors = lintDiagnostics.filter((d) => d.severity === 'error');
    expect(lintErrors).toHaveLength(0);

    // Step 3: Tier (already computed during compile, but verify independently)
    const tierScore = computeTier('retail-sales', graph);
    expect(tierScore.tier).toBe('gold');

    // Step 4: Emit manifest
    const config = loadConfig(FIXTURES_VALID);
    const manifest = emitManifest(graph, config);
    expect(manifest.version).toBe('0.3.5');
    expect(Object.keys(manifest.models).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(manifest.tiers).length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Verify graph indexes are populated
// ---------------------------------------------------------------------------
describe('integration: graph indexes', () => {
  it('has all indexes populated correctly', async () => {
    const { graph } = await getValidResult();

    // byOwner: analytics-team should include retail-sales
    expect(graph.indexes.byOwner.has('analytics-team')).toBe(true);
    expect(graph.indexes.byOwner.get('analytics-team')).toContain('retail-sales');

    // byTag: finance, revenue, kpi tags should all include retail-sales
    expect(graph.indexes.byTag.has('finance')).toBe(true);
    expect(graph.indexes.byTag.get('finance')).toContain('retail-sales');
    expect(graph.indexes.byTag.has('revenue')).toBe(true);
    expect(graph.indexes.byTag.get('revenue')).toContain('retail-sales');
    expect(graph.indexes.byTag.has('kpi')).toBe(true);
    expect(graph.indexes.byTag.get('kpi')).toContain('retail-sales');

    // byTrust: endorsed should include retail-sales
    expect(graph.indexes.byTrust.has('endorsed')).toBe(true);
    expect(graph.indexes.byTrust.get('endorsed')).toContain('retail-sales');

    // modelToGovernance
    expect(graph.indexes.modelToGovernance.get('retail-sales')).toBe('retail-sales');

    // modelToRules
    expect(graph.indexes.modelToRules.get('retail-sales')).toBe('retail-sales');

    // modelToLineage
    expect(graph.indexes.modelToLineage.get('retail-sales')).toBe('retail-sales');
  });
});

// ---------------------------------------------------------------------------
// 8. Verify relationships and metrics in the compiled graph
// ---------------------------------------------------------------------------
describe('integration: relationships and metrics', () => {
  it('has relationships and metrics present in the compiled model', async () => {
    const { graph } = await getValidResult();

    const model = graph.models.get('retail-sales');
    expect(model).toBeDefined();

    // Relationships
    expect(model!.relationships).toBeDefined();
    expect(model!.relationships!.length).toBeGreaterThanOrEqual(1);
    const txnToCustomer = model!.relationships!.find((r) => r.name === 'txn_to_customer');
    expect(txnToCustomer).toBeDefined();
    expect(txnToCustomer!.from).toBe('transactions');
    expect(txnToCustomer!.to).toBe('customers');
    expect(txnToCustomer!.from_columns).toEqual(['customer_id']);
    expect(txnToCustomer!.to_columns).toEqual(['customer_id']);

    // Metrics
    expect(model!.metrics).toBeDefined();
    expect(model!.metrics!.length).toBeGreaterThanOrEqual(3);

    const totalRevenue = model!.metrics!.find((m) => m.name === 'total_revenue');
    expect(totalRevenue).toBeDefined();
    expect(totalRevenue!.description).toContain('Total revenue');

    const avgOrderValue = model!.metrics!.find((m) => m.name === 'avg_order_value');
    expect(avgOrderValue).toBeDefined();

    const customerCount = model!.metrics!.find((m) => m.name === 'customer_count');
    expect(customerCount).toBeDefined();

    // Datasets
    expect(model!.datasets.length).toBe(2);
    const transactions = model!.datasets.find((ds) => ds.name === 'transactions');
    expect(transactions).toBeDefined();
    expect(transactions!.fields).toBeDefined();
    expect(transactions!.fields!.length).toBe(4);

    const customers = model!.datasets.find((ds) => ds.name === 'customers');
    expect(customers).toBeDefined();
    expect(customers!.fields).toBeDefined();
    expect(customers!.fields!.length).toBe(3);

    // Governance metadata
    const gov = graph.governance.get('retail-sales');
    expect(gov).toBeDefined();
    expect(gov!.owner).toBe('analytics-team');
    expect(gov!.trust).toBe('endorsed');
    expect(gov!.security).toBe('internal');
    expect(gov!.tags).toEqual(['finance', 'revenue', 'kpi']);

    // Rules metadata
    const rules = graph.rules.get('retail-sales');
    expect(rules).toBeDefined();
    expect(rules!.golden_queries).toBeDefined();
    expect(rules!.golden_queries!.length).toBe(3);
    expect(rules!.business_rules).toBeDefined();
    expect(rules!.business_rules!.length).toBe(1);
    expect(rules!.guardrail_filters).toBeDefined();
    expect(rules!.guardrail_filters!.length).toBe(1);
    expect(rules!.hierarchies).toBeDefined();
    expect(rules!.hierarchies!.length).toBe(1);

    // Lineage metadata
    const lineage = graph.lineage.get('retail-sales');
    expect(lineage).toBeDefined();
    expect(lineage!.upstream).toBeDefined();
    expect(lineage!.upstream!.length).toBe(1);
    expect(lineage!.upstream![0]!.source).toBe('erp.orders');
    expect(lineage!.downstream).toBeDefined();
    expect(lineage!.downstream!.length).toBe(1);
    expect(lineage!.downstream![0]!.target).toBe('executive-dashboard');

    // Glossary term
    const term = graph.terms.get('revenue');
    expect(term).toBeDefined();
    expect(term!.definition).toContain('completed transactions');
    expect(term!.synonyms).toContain('sales');
    expect(term!.owner).toBe('analytics-team');

    // Owner
    const owner = graph.owners.get('analytics-team');
    expect(owner).toBeDefined();
    expect(owner!.display_name).toBe('Analytics Team');
    expect(owner!.email).toBe('analytics@company.com');
  });
});
