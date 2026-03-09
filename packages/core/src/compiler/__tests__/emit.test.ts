import { describe, it, expect, vi } from 'vitest';
import type {
  ContextGraph,
  RunContextConfig,
  OsiSemanticModel,
  GovernanceFile,
  RulesFile,
  LineageFile,
  TermFile,
  OwnerFile,
  TierScore,
} from '../../types/index.js';
import { createEmptyGraph } from '../graph.js';
import { emitManifest } from '../emit.js';
import type { Manifest } from '../emit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildTestGraph(): ContextGraph {
  const graph = createEmptyGraph();

  const model: OsiSemanticModel = {
    name: 'sales',
    description: 'Sales model',
    datasets: [
      {
        name: 'orders',
        source: 'db.orders',
        fields: [
          {
            name: 'order_id',
            description: 'ID',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'order_id' }] },
          },
        ],
      },
    ],
  };
  graph.models.set('sales', model);

  const gov: GovernanceFile = {
    model: 'sales',
    owner: 'data-team',
    trust: 'endorsed',
    security: 'internal',
    tags: ['revenue'],
  };
  graph.governance.set('sales', gov);

  const rules: RulesFile = {
    model: 'sales',
    golden_queries: [{ question: 'Q?', sql: 'SELECT 1' }],
  };
  graph.rules.set('sales', rules);

  const lineage: LineageFile = {
    model: 'sales',
    upstream: [{ source: 'erp.orders', type: 'pipeline' }],
  };
  graph.lineage.set('sales', lineage);

  const term: TermFile = {
    id: 'revenue',
    definition: 'Total sales',
    tags: ['finance'],
    owner: 'data-team',
  };
  graph.terms.set('revenue', term);

  const owner: OwnerFile = {
    id: 'data-team',
    display_name: 'Data Team',
    email: 'data@co.com',
  };
  graph.owners.set('data-team', owner);

  const tierScore: TierScore = {
    model: 'sales',
    tier: 'silver',
    bronze: { passed: true, checks: [] },
    silver: { passed: true, checks: [] },
    gold: { passed: false, checks: [] },
  };
  graph.tiers.set('sales', tierScore);

  return graph;
}

const defaultConfig: RunContextConfig = {
  context_dir: 'context',
  output_dir: 'dist',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('emitManifest', () => {
  it('returns a Manifest with all top-level keys', () => {
    const graph = buildTestGraph();
    const manifest = emitManifest(graph, defaultConfig);

    expect(manifest).toHaveProperty('version');
    expect(manifest).toHaveProperty('generatedAt');
    expect(manifest).toHaveProperty('models');
    expect(manifest).toHaveProperty('governance');
    expect(manifest).toHaveProperty('rules');
    expect(manifest).toHaveProperty('lineage');
    expect(manifest).toHaveProperty('terms');
    expect(manifest).toHaveProperty('owners');
    expect(manifest).toHaveProperty('tiers');
  });

  it('converts Maps to plain Records (JSON-serializable)', () => {
    const graph = buildTestGraph();
    const manifest = emitManifest(graph, defaultConfig);

    // Should be plain objects, not Maps
    expect(manifest.models).not.toBeInstanceOf(Map);
    expect(manifest.governance).not.toBeInstanceOf(Map);
    expect(manifest.rules).not.toBeInstanceOf(Map);
    expect(manifest.lineage).not.toBeInstanceOf(Map);
    expect(manifest.terms).not.toBeInstanceOf(Map);
    expect(manifest.owners).not.toBeInstanceOf(Map);
    expect(manifest.tiers).not.toBeInstanceOf(Map);

    // Verify JSON.stringify round-trips cleanly
    const json = JSON.stringify(manifest);
    const parsed = JSON.parse(json);
    expect(parsed.models).toEqual(manifest.models);
    expect(parsed.tiers).toEqual(manifest.tiers);
  });

  it('preserves model data in the models record', () => {
    const graph = buildTestGraph();
    const manifest = emitManifest(graph, defaultConfig);

    expect(manifest.models['sales']).toBeDefined();
    expect(manifest.models['sales']!.name).toBe('sales');
    expect(manifest.models['sales']!.description).toBe('Sales model');
  });

  it('preserves governance, rules, lineage, terms, owners, tiers data', () => {
    const graph = buildTestGraph();
    const manifest = emitManifest(graph, defaultConfig);

    expect(manifest.governance['sales']!.owner).toBe('data-team');
    expect(manifest.rules['sales']!.golden_queries).toHaveLength(1);
    expect(manifest.lineage['sales']!.upstream).toHaveLength(1);
    expect(manifest.terms['revenue']!.definition).toBe('Total sales');
    expect(manifest.owners['data-team']!.email).toBe('data@co.com');
    expect(manifest.tiers['sales']!.tier).toBe('silver');
  });

  it('includes a valid ISO generatedAt timestamp', () => {
    const graph = buildTestGraph();
    const manifest = emitManifest(graph, defaultConfig);

    // generatedAt should be a valid ISO date string
    const date = new Date(manifest.generatedAt);
    expect(date.getTime()).not.toBeNaN();
  });

  it('handles an empty graph gracefully', () => {
    const graph = createEmptyGraph();
    const manifest = emitManifest(graph, defaultConfig);

    expect(manifest.models).toEqual({});
    expect(manifest.governance).toEqual({});
    expect(manifest.rules).toEqual({});
    expect(manifest.lineage).toEqual({});
    expect(manifest.terms).toEqual({});
    expect(manifest.owners).toEqual({});
    expect(manifest.tiers).toEqual({});
  });
});
