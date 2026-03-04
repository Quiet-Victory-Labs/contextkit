import { describe, it, expect } from 'vitest';
import path from 'node:path';
import type { ContextGraph, OsiSemanticModel } from '../../types/index.js';
import { compile } from '../../compiler/pipeline.js';
import { createEmptyGraph } from '../../compiler/graph.js';

// Silver rules
import { governanceTrustRequired } from '../rules/governance-trust-required.js';
import { governanceRefreshRequired } from '../rules/governance-refresh-required.js';
import { lineageUpstreamRequired } from '../rules/lineage-upstream-required.js';

// Gold rules
import { governanceSemanticRoleRequired } from '../rules/governance-semantic-role-required.js';
import { governanceAggregationRequired } from '../rules/governance-aggregation-required.js';
import { governanceAdditiveRequired } from '../rules/governance-additive-required.js';
import { rulesGoldenQueriesMinimum } from '../rules/rules-golden-queries-minimum.js';
import { rulesBusinessRulesExist } from '../rules/rules-business-rules-exist.js';
import { rulesGuardrailsExist } from '../rules/rules-guardrails-exist.js';
import { rulesHierarchiesExist } from '../rules/rules-hierarchies-exist.js';

// Composite tier rules
import { tierBronze } from '../rules/tier-bronze.js';
import { tierSilver } from '../rules/tier-silver.js';
import { tierGold } from '../rules/tier-gold.js';

import { ALL_RULES } from '../rules/index.js';

const FIXTURES_VALID = path.resolve(__dirname, '../../../../../fixtures/valid');

/** Minimal OSI model for testing. */
function minimalModel(name: string): OsiSemanticModel {
  return {
    name,
    description: 'A test model',
    datasets: [
      {
        name: 'orders',
        source: 'db.schema.orders',
        description: 'Orders dataset',
        fields: [
          {
            name: 'order_id',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'order_id' }] },
            description: 'Primary key',
          },
          {
            name: 'amount',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'amount' }] },
            description: 'Order amount',
          },
          {
            name: 'order_date',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'order_date' }] },
            description: 'Order date',
          },
        ],
      },
    ],
  };
}

/** Build a valid graph from fixture files. */
async function validGraph(): Promise<ContextGraph> {
  const { graph } = await compile({ contextDir: FIXTURES_VALID });
  return graph;
}

// ---------------------------------------------------------------------------
// ALL_RULES count
// ---------------------------------------------------------------------------
describe('ALL_RULES with Silver/Gold', () => {
  it('ALL_RULES array contains 25 rules', () => {
    expect(ALL_RULES).toHaveLength(33);
  });

  it('all 33 rules produce 0 diagnostics on valid fixtures', async () => {
    const graph = await validGraph();
    for (const rule of ALL_RULES) {
      const diags = rule.run(graph);
      expect(diags, `Rule "${rule.id}" should produce no diagnostics on valid fixtures`).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Silver: governance-trust-required
// ---------------------------------------------------------------------------
describe('governance/trust-required', () => {
  it('passes when governance has trust status', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', { model: 'm', owner: 'team', trust: 'endorsed' });
    expect(governanceTrustRequired.run(graph)).toHaveLength(0);
  });

  it('fails when governance is missing trust status', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', { model: 'm', owner: 'team' });
    const diags = governanceTrustRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('governance/trust-required');
    expect(diags[0]!.message).toContain('trust');
  });
});

// ---------------------------------------------------------------------------
// Silver: governance-refresh-required
// ---------------------------------------------------------------------------
describe('governance/refresh-required', () => {
  it('passes when all datasets have refresh cadence', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      datasets: {
        orders: { grain: 'One row per order', table_type: 'fact', refresh: 'daily' },
      },
    });
    expect(governanceRefreshRequired.run(graph)).toHaveLength(0);
  });

  it('fails when dataset is missing refresh cadence', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      datasets: {
        orders: { grain: 'One row per order', table_type: 'fact' },
      },
    });
    const diags = governanceRefreshRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('governance/refresh-required');
    expect(diags[0]!.message).toContain('orders');
  });
});

// ---------------------------------------------------------------------------
// Silver: lineage-upstream-required
// ---------------------------------------------------------------------------
describe('lineage/upstream-required', () => {
  it('passes when governed model has lineage with upstream', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', { model: 'm', owner: 'team' });
    graph.lineage.set('m', {
      model: 'm',
      upstream: [{ source: 'raw.orders', type: 'pipeline' }],
    });
    graph.indexes.modelToGovernance.set('m', 'm');
    graph.indexes.modelToLineage.set('m', 'm');
    expect(lineageUpstreamRequired.run(graph)).toHaveLength(0);
  });

  it('fails when governed model has no lineage file', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', { model: 'm', owner: 'team' });
    graph.indexes.modelToGovernance.set('m', 'm');
    const diags = lineageUpstreamRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('lineage/upstream-required');
  });

  it('fails when lineage exists but has no upstream entries', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', { model: 'm', owner: 'team' });
    graph.lineage.set('m', { model: 'm', upstream: [] });
    graph.indexes.modelToGovernance.set('m', 'm');
    graph.indexes.modelToLineage.set('m', 'm');
    const diags = lineageUpstreamRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Gold: governance-semantic-role-required
// ---------------------------------------------------------------------------
describe('governance/semantic-role-required', () => {
  it('passes when all fields have semantic_role in governance', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'orders.order_id': { semantic_role: 'identifier' },
        'orders.amount': { semantic_role: 'metric', default_aggregation: 'SUM', additive: true },
        'orders.order_date': { semantic_role: 'date' },
      },
    });
    graph.indexes.modelToGovernance.set('m', 'm');
    expect(governanceSemanticRoleRequired.run(graph)).toHaveLength(0);
  });

  it('fails when a field is missing from governance fields', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'orders.order_id': { semantic_role: 'identifier' },
        // amount and order_date missing
      },
    });
    graph.indexes.modelToGovernance.set('m', 'm');
    const diags = governanceSemanticRoleRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('governance/semantic-role-required');
  });

  it('fails when governance has no fields at all', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', { model: 'm', owner: 'team' });
    graph.indexes.modelToGovernance.set('m', 'm');
    const diags = governanceSemanticRoleRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Gold: governance-aggregation-required
// ---------------------------------------------------------------------------
describe('governance/aggregation-required', () => {
  it('passes when all metric fields have default_aggregation', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'orders.amount': { semantic_role: 'metric', default_aggregation: 'SUM', additive: true },
        'orders.order_id': { semantic_role: 'identifier' },
      },
    });
    expect(governanceAggregationRequired.run(graph)).toHaveLength(0);
  });

  it('fails when metric field is missing default_aggregation', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'orders.amount': { semantic_role: 'metric', additive: true },
      },
    });
    const diags = governanceAggregationRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('governance/aggregation-required');
    expect(diags[0]!.message).toContain('orders.amount');
  });
});

// ---------------------------------------------------------------------------
// Gold: governance-additive-required
// ---------------------------------------------------------------------------
describe('governance/additive-required', () => {
  it('passes when all metric fields have additive flag', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'orders.amount': { semantic_role: 'metric', default_aggregation: 'SUM', additive: true },
        'orders.order_id': { semantic_role: 'identifier' },
      },
    });
    expect(governanceAdditiveRequired.run(graph)).toHaveLength(0);
  });

  it('fails when metric field is missing additive flag', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'orders.amount': { semantic_role: 'metric', default_aggregation: 'SUM' },
      },
    });
    const diags = governanceAdditiveRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('governance/additive-required');
    expect(diags[0]!.message).toContain('orders.amount');
  });
});

// ---------------------------------------------------------------------------
// Gold: rules-golden-queries-minimum
// ---------------------------------------------------------------------------
describe('rules/golden-queries-minimum', () => {
  it('passes when >=3 golden queries', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      golden_queries: [
        { question: 'Q1', sql: 'SELECT 1' },
        { question: 'Q2', sql: 'SELECT 2' },
        { question: 'Q3', sql: 'SELECT 3' },
      ],
    });
    expect(rulesGoldenQueriesMinimum.run(graph)).toHaveLength(0);
  });

  it('fails when <3 golden queries', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      golden_queries: [
        { question: 'Q1', sql: 'SELECT 1' },
      ],
    });
    const diags = rulesGoldenQueriesMinimum.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('rules/golden-queries-minimum');
  });

  it('fails when golden_queries is undefined', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', { model: 'm' });
    const diags = rulesGoldenQueriesMinimum.run(graph);
    expect(diags.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Gold: rules-business-rules-exist
// ---------------------------------------------------------------------------
describe('rules/business-rules-exist', () => {
  it('passes when >=1 business rule', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      business_rules: [
        { name: 'rule-1', definition: 'A rule' },
      ],
    });
    expect(rulesBusinessRulesExist.run(graph)).toHaveLength(0);
  });

  it('fails when no business rules', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', { model: 'm', business_rules: [] });
    const diags = rulesBusinessRulesExist.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('rules/business-rules-exist');
  });
});

// ---------------------------------------------------------------------------
// Gold: rules-guardrails-exist
// ---------------------------------------------------------------------------
describe('rules/guardrails-exist', () => {
  it('passes when >=1 guardrail filter', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      guardrail_filters: [
        { name: 'g1', filter: 'x > 0', reason: 'test' },
      ],
    });
    expect(rulesGuardrailsExist.run(graph)).toHaveLength(0);
  });

  it('fails when no guardrail filters', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', { model: 'm', guardrail_filters: [] });
    const diags = rulesGuardrailsExist.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('rules/guardrails-exist');
  });
});

// ---------------------------------------------------------------------------
// Gold: rules-hierarchies-exist
// ---------------------------------------------------------------------------
describe('rules/hierarchies-exist', () => {
  it('passes when >=1 hierarchy', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      hierarchies: [
        { name: 'h1', levels: ['a', 'b'], dataset: 'orders' },
      ],
    });
    expect(rulesHierarchiesExist.run(graph)).toHaveLength(0);
  });

  it('fails when no hierarchies', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', { model: 'm', hierarchies: [] });
    const diags = rulesHierarchiesExist.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('rules/hierarchies-exist');
  });
});

// ---------------------------------------------------------------------------
// Composite: tier/bronze-requirements
// ---------------------------------------------------------------------------
describe('tier/bronze-requirements', () => {
  it('passes on valid fixtures (Gold-compliant)', async () => {
    const graph = await validGraph();
    expect(tierBronze.run(graph)).toHaveLength(0);
  });

  it('produces diagnostic for minimal graph missing Bronze requirements', () => {
    const graph = createEmptyGraph();
    const model: OsiSemanticModel = {
      name: 'bare',
      datasets: [
        {
          name: 'tbl',
          source: 'db.tbl',
          fields: [
            {
              name: 'col',
              expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'col' }] },
            },
          ],
        },
      ],
    };
    graph.models.set('bare', model);
    // No governance at all
    const diags = tierBronze.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('tier/bronze-requirements');
  });
});

// ---------------------------------------------------------------------------
// Composite: tier/silver-requirements
// ---------------------------------------------------------------------------
describe('tier/silver-requirements', () => {
  it('passes on valid fixtures (Gold-compliant)', async () => {
    const graph = await validGraph();
    expect(tierSilver.run(graph)).toHaveLength(0);
  });

  it('produces diagnostic for graph missing Silver requirements', () => {
    const graph = createEmptyGraph();
    const model = minimalModel('m');
    graph.models.set('m', model);
    // Governance with Bronze stuff but missing Silver stuff (no trust, no tags, no refresh)
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      security: 'internal',
      datasets: {
        orders: { grain: 'One row', table_type: 'fact' },
      },
    });
    graph.indexes.modelToGovernance.set('m', 'm');
    const diags = tierSilver.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('tier/silver-requirements');
  });
});

// ---------------------------------------------------------------------------
// Composite: tier/gold-requirements
// ---------------------------------------------------------------------------
describe('tier/gold-requirements', () => {
  it('passes on valid fixtures (Gold-compliant)', async () => {
    const graph = await validGraph();
    expect(tierGold.run(graph)).toHaveLength(0);
  });

  it('produces diagnostic for graph missing Gold requirements', () => {
    const graph = createEmptyGraph();
    const model = minimalModel('m');
    graph.models.set('m', model);
    // Has Silver-level governance but missing Gold stuff
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      trust: 'warning', // not 'endorsed'
      security: 'internal',
      tags: ['finance', 'kpi'],
      datasets: {
        orders: { grain: 'One row', table_type: 'fact', refresh: 'daily' },
      },
      fields: {
        'orders.order_id': { semantic_role: 'identifier' },
        'orders.amount': { semantic_role: 'metric', default_aggregation: 'SUM', additive: true },
        'orders.order_date': { semantic_role: 'date' },
      },
    });
    graph.lineage.set('m', {
      model: 'm',
      upstream: [{ source: 'raw.orders', type: 'pipeline' }],
    });
    graph.rules.set('m', { model: 'm' }); // No golden queries, no business rules, etc.
    graph.indexes.modelToGovernance.set('m', 'm');
    graph.indexes.modelToRules.set('m', 'm');
    graph.indexes.modelToLineage.set('m', 'm');
    const diags = tierGold.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('tier/gold-requirements');
  });
});
