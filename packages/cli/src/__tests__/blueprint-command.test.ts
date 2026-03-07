import { describe, it, expect } from 'vitest';
import { emitBlueprint } from '../commands/blueprint.js';
import type { Manifest } from '@runcontext/core';

/** Build a minimal manifest with sensible defaults, allowing partial overrides. */
function makeManifest(overrides: {
  models?: Manifest['models'];
  governance?: Manifest['governance'];
  rules?: Manifest['rules'];
  tiers?: Manifest['tiers'];
  terms?: Manifest['terms'];
} = {}): Manifest {
  return {
    version: '0.4.1',
    generatedAt: new Date().toISOString(),
    models: overrides.models ?? {},
    governance: overrides.governance ?? {},
    rules: overrides.rules ?? {},
    lineage: {},
    terms: overrides.terms ?? {},
    owners: {},
    tiers: overrides.tiers ?? {},
  };
}

describe('emitBlueprint', () => {
  it('emits valid YAML with correct header', () => {
    const manifest = makeManifest({
      models: {
        sales: {
          name: 'sales',
          datasets: [],
        },
      },
    });
    const output = emitBlueprint('sales', manifest);

    expect(output).toContain('# sales.data-product.osi.yaml');
    expect(output).toContain('# AI Blueprint');
    expect(output).toContain('osi_version: "1.0"');
    expect(output).toContain('semantic_model:');
    expect(output).toContain('  name: sales');
  });

  it('includes model name, description, and tier', () => {
    const manifest = makeManifest({
      models: {
        analytics: {
          name: 'analytics',
          description: 'Analytics data product for BI',
          datasets: [],
        },
      },
      tiers: {
        analytics: {
          model: 'analytics',
          tier: 'gold',
          bronze: { passed: true, checks: [] },
          silver: { passed: true, checks: [] },
          gold: { passed: true, checks: [] },
        },
      },
    });
    const output = emitBlueprint('analytics', manifest);

    expect(output).toContain('  name: analytics');
    expect(output).toContain('  description: >');
    expect(output).toContain('Analytics data product for BI');
    expect(output).toContain('  tier: gold');
  });

  it('includes datasets with fields', () => {
    const manifest = makeManifest({
      models: {
        sales: {
          name: 'sales',
          datasets: [
            {
              name: 'orders',
              source: 'public.orders',
              primary_key: ['id'],
              description: 'All customer orders',
              fields: [
                {
                  name: 'id',
                  expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'id' }] },
                  description: 'Order identifier',
                },
                {
                  name: 'amount',
                  expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'amount' }] },
                  description: 'Order amount in USD',
                  dimension: { is_time: false },
                },
              ],
            },
          ],
        },
      },
    });
    const output = emitBlueprint('sales', manifest);

    expect(output).toContain('  datasets:');
    expect(output).toContain('    - name: orders');
    expect(output).toContain('      source: public.orders');
    expect(output).toContain('      primary_key: [id]');
    expect(output).toContain('      description: All customer orders');
    expect(output).toContain('      fields:');
    expect(output).toContain('        - name: id');
    expect(output).toContain('          description: Order identifier');
    expect(output).toContain('        - name: amount');
  });

  it('includes relationships', () => {
    const manifest = makeManifest({
      models: {
        sales: {
          name: 'sales',
          datasets: [],
          relationships: [
            {
              name: 'orders_to_customers',
              from: 'orders',
              to: 'customers',
              from_columns: ['customer_id'],
              to_columns: ['id'],
              cardinality: 'many_to_one',
            },
          ],
        },
      },
    });
    const output = emitBlueprint('sales', manifest);

    expect(output).toContain('  relationships:');
    expect(output).toContain('    - name: orders_to_customers');
    expect(output).toContain('      from:');
    expect(output).toContain('        dataset: orders');
    expect(output).toContain('        columns: [customer_id]');
    expect(output).toContain('      to:');
    expect(output).toContain('        dataset: customers');
    expect(output).toContain('        columns: [id]');
    expect(output).toContain('      cardinality: many_to_one');
  });

  it('includes metrics', () => {
    const manifest = makeManifest({
      models: {
        sales: {
          name: 'sales',
          datasets: [],
          metrics: [
            {
              name: 'total_revenue',
              expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'SUM(amount)' }] },
              description: 'Total revenue across all orders',
            },
          ],
        },
      },
    });
    const output = emitBlueprint('sales', manifest);

    expect(output).toContain('  metrics:');
    expect(output).toContain('    - name: total_revenue');
    expect(output).toContain('      description: Total revenue across all orders');
  });

  it('includes business rules and golden queries', () => {
    const manifest = makeManifest({
      models: {
        sales: { name: 'sales', datasets: [] },
      },
      rules: {
        sales: {
          model: 'sales',
          business_rules: [
            {
              name: 'exclude-test-orders',
              definition: 'Always exclude test orders from reporting',
              enforcement: ['WHERE is_test = false'],
              applied_always: true,
            },
          ],
          golden_queries: [
            {
              question: 'What is total revenue this month?',
              sql: 'SELECT SUM(amount) FROM orders\nWHERE date >= DATE_TRUNC(month, CURRENT_DATE)',
              dialect: 'SNOWFLAKE',
            },
          ],
        },
      },
    });
    const output = emitBlueprint('sales', manifest);

    expect(output).toContain('  business_rules:');
    expect(output).toContain('    - name: exclude-test-orders');
    expect(output).toContain('      definition: Always exclude test orders from reporting');
    expect(output).toContain('      enforcement:');
    expect(output).toContain('      applied_always: true');

    expect(output).toContain('  golden_queries:');
    expect(output).toContain('    - question: What is total revenue this month?');
    expect(output).toContain('      sql: |');
    expect(output).toContain('      dialect: SNOWFLAKE');
  });

  it('handles missing optional sections gracefully', () => {
    const manifest = makeManifest({
      models: {
        minimal: {
          name: 'minimal',
          datasets: [],
          // no relationships, metrics, description
        },
      },
      // no governance, rules, tiers
    });
    const output = emitBlueprint('minimal', manifest);

    expect(output).toContain('  name: minimal');
    // Should not contain optional sections
    expect(output).not.toContain('  relationships:');
    expect(output).not.toContain('  metrics:');
    expect(output).not.toContain('  business_rules:');
    expect(output).not.toContain('  golden_queries:');
    expect(output).not.toContain('  guardrail_filters:');
    expect(output).not.toContain('  glossary:');
    // Should still have the basic structure
    expect(output).toContain('osi_version: "1.0"');
    expect(output).toContain('semantic_model:');
  });

  it('includes governance owner and trust status', () => {
    const manifest = makeManifest({
      models: {
        sales: { name: 'sales', datasets: [] },
      },
      governance: {
        sales: {
          model: 'sales',
          owner: 'data-team',
          trust: 'endorsed',
          tags: ['revenue', 'finance'],
        },
      },
    });
    const output = emitBlueprint('sales', manifest);

    expect(output).toContain('  owner: data-team');
    expect(output).toContain('  trust_status: endorsed');
    expect(output).toContain('  tags:');
    expect(output).toContain('    - revenue');
    expect(output).toContain('    - finance');
  });

  it('includes guardrail filters', () => {
    const manifest = makeManifest({
      models: {
        sales: { name: 'sales', datasets: [] },
      },
      rules: {
        sales: {
          model: 'sales',
          guardrail_filters: [
            {
              name: 'exclude-deleted',
              reason: 'Deleted records should never appear in reports',
              filter: 'is_deleted = false',
              tables: ['orders', 'customers'],
            },
          ],
        },
      },
    });
    const output = emitBlueprint('sales', manifest);

    expect(output).toContain('  guardrail_filters:');
    expect(output).toContain('    - name: exclude-deleted');
    expect(output).toContain('      reason: Deleted records should never appear in reports');
    expect(output).toContain('      filter: is_deleted = false');
    expect(output).toContain('      tables: [orders, customers]');
  });
});
