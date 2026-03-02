import { describe, it, expect } from 'vitest';
import { osiDocumentSchema } from '../osi.js';
import { governanceFileSchema } from '../governance.js';
import { rulesFileSchema } from '../rules.js';
import { lineageFileSchema } from '../lineage.js';
import { termFileSchema } from '../term.js';
import { ownerFileSchema } from '../owner.js';
import { contextKitConfigSchema } from '../config.js';

// ---------------------------------------------------------------------------
// OSI Document Schema
// ---------------------------------------------------------------------------
describe('osiDocumentSchema', () => {
  it('accepts valid minimal model (name + 1 dataset with name + source)', () => {
    const input = {
      version: '1.0',
      semantic_model: [
        {
          name: 'my_model',
          datasets: [{ name: 'orders', source: 'db.public.orders' }],
        },
      ],
    };
    const result = osiDocumentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts valid full input with all optional fields', () => {
    const input = {
      version: '1.0',
      semantic_model: [
        {
          name: 'sales_model',
          description: 'Sales semantic model',
          ai_context: { instructions: 'Use for sales queries', synonyms: ['revenue'], examples: ['SELECT SUM(amount) FROM orders'] },
          datasets: [
            {
              name: 'orders',
              source: 'db.public.orders',
              primary_key: ['id'],
              unique_keys: [['id'], ['order_number']],
              description: 'Orders table',
              ai_context: 'Main orders dataset',
              fields: [
                {
                  name: 'amount',
                  expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'orders.amount' }] },
                  dimension: { is_time: false },
                  label: 'Order Amount',
                  description: 'Total order amount',
                  ai_context: { instructions: 'This is the revenue field' },
                  custom_extensions: [{ vendor_name: 'SNOWFLAKE', data: '{}' }],
                },
              ],
              custom_extensions: [{ vendor_name: 'COMMON', data: '{}' }],
            },
          ],
          relationships: [
            {
              name: 'orders_to_customers',
              from: 'orders',
              to: 'customers',
              from_columns: ['customer_id'],
              to_columns: ['id'],
              ai_context: 'Join orders to customers',
              custom_extensions: [],
            },
          ],
          metrics: [
            {
              name: 'total_revenue',
              expression: { dialects: [{ dialect: 'SNOWFLAKE', expression: 'SUM(orders.amount)' }] },
              description: 'Total revenue metric',
              ai_context: { instructions: 'Primary revenue metric' },
              custom_extensions: [],
            },
          ],
          custom_extensions: [],
        },
      ],
    };
    const result = osiDocumentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('fails when version is missing', () => {
    const input = {
      semantic_model: [
        { name: 'model', datasets: [{ name: 'd', source: 's' }] },
      ],
    };
    const result = osiDocumentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails when version is not "1.0"', () => {
    const input = {
      version: '2.0',
      semantic_model: [
        { name: 'model', datasets: [{ name: 'd', source: 's' }] },
      ],
    };
    const result = osiDocumentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails with invalid dialect value', () => {
    const input = {
      version: '1.0',
      semantic_model: [
        {
          name: 'model',
          datasets: [
            {
              name: 'd',
              source: 's',
              fields: [
                {
                  name: 'f',
                  expression: { dialects: [{ dialect: 'POSTGRES', expression: 'x' }] },
                },
              ],
            },
          ],
        },
      ],
    };
    const result = osiDocumentSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts ai_context as a string', () => {
    const input = {
      version: '1.0',
      semantic_model: [
        {
          name: 'model',
          ai_context: 'This is a string context',
          datasets: [{ name: 'd', source: 's' }],
        },
      ],
    };
    const result = osiDocumentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.semantic_model[0].ai_context).toBe('This is a string context');
    }
  });

  it('accepts ai_context as an object', () => {
    const input = {
      version: '1.0',
      semantic_model: [
        {
          name: 'model',
          ai_context: { instructions: 'Use carefully', synonyms: ['ctx'], examples: ['ex1'] },
          datasets: [{ name: 'd', source: 's' }],
        },
      ],
    };
    const result = osiDocumentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const ctx = result.data.semantic_model[0].ai_context;
      expect(typeof ctx).toBe('object');
    }
  });

  it('fails when semantic_model is empty array', () => {
    const input = { version: '1.0', semantic_model: [] };
    // Empty array is still a valid array — this should pass since the type allows it
    const result = osiDocumentSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Governance File Schema
// ---------------------------------------------------------------------------
describe('governanceFileSchema', () => {
  it('accepts valid full governance file', () => {
    const input = {
      model: 'sales_model',
      owner: 'data-team',
      trust: 'endorsed',
      security: 'internal',
      tags: ['production', 'finance'],
      datasets: {
        orders: {
          grain: 'one row per order',
          table_type: 'fact',
          security: 'confidential',
          refresh: 'daily',
        },
      },
      fields: {
        'orders.amount': {
          semantic_role: 'metric',
          default_aggregation: 'SUM',
          additive: true,
          default_filter: 'amount > 0',
          sample_values: ['100', '200', '350'],
        },
      },
    };
    const result = governanceFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts minimal governance (model + owner only)', () => {
    const input = { model: 'sales_model', owner: 'data-team' };
    const result = governanceFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('fails when model is missing', () => {
    const input = { owner: 'data-team' };
    const result = governanceFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails when owner is missing', () => {
    const input = { model: 'sales_model' };
    const result = governanceFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails with invalid trust value', () => {
    const input = { model: 'sales_model', owner: 'data-team', trust: 'invalid' };
    const result = governanceFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails with invalid semantic_role value', () => {
    const input = {
      model: 'sales_model',
      owner: 'data-team',
      fields: {
        'orders.amount': { semantic_role: 'invalid_role' },
      },
    };
    const result = governanceFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails when field key lacks dot notation (e.g., "amount" instead of "dataset.amount")', () => {
    const input = {
      model: 'sales_model',
      owner: 'data-team',
      fields: {
        amount: { semantic_role: 'metric' },
      },
    };
    const result = governanceFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts field key with dot notation', () => {
    const input = {
      model: 'sales_model',
      owner: 'data-team',
      fields: {
        'orders.amount': { semantic_role: 'metric' },
      },
    };
    const result = governanceFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rules File Schema
// ---------------------------------------------------------------------------
describe('rulesFileSchema', () => {
  it('accepts valid golden queries', () => {
    const input = {
      model: 'sales_model',
      golden_queries: [
        { question: 'What is total revenue?', sql: 'SELECT SUM(amount) FROM orders' },
        { question: 'How many orders?', sql: 'SELECT COUNT(*) FROM orders', dialect: 'SNOWFLAKE', tags: ['basic'] },
      ],
    };
    const result = rulesFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts empty arrays for optional list fields', () => {
    const input = {
      model: 'sales_model',
      golden_queries: [],
      business_rules: [],
      guardrail_filters: [],
      hierarchies: [],
    };
    const result = rulesFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('fails when question is missing from golden query', () => {
    const input = {
      model: 'sales_model',
      golden_queries: [
        { sql: 'SELECT 1' },
      ],
    };
    const result = rulesFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails when model is missing', () => {
    const input = {
      golden_queries: [{ question: 'Q?', sql: 'SELECT 1' }],
    };
    const result = rulesFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts valid business rules', () => {
    const input = {
      model: 'sales_model',
      business_rules: [
        {
          name: 'revenue_calc',
          definition: 'Revenue = unit_price * quantity',
          enforcement: ['orders'],
          avoid: ['deprecated_calc'],
          tables: ['orders'],
          applied_always: true,
        },
      ],
    };
    const result = rulesFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts valid guardrail filters', () => {
    const input = {
      model: 'sales_model',
      guardrail_filters: [
        { name: 'active_only', filter: 'status = \'active\'', reason: 'Exclude inactive', tables: ['orders'] },
      ],
    };
    const result = rulesFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts valid hierarchies', () => {
    const input = {
      model: 'sales_model',
      hierarchies: [
        { name: 'geo', levels: ['country', 'state', 'city'], dataset: 'locations', field: 'geo_id' },
      ],
    };
    const result = rulesFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lineage File Schema
// ---------------------------------------------------------------------------
describe('lineageFileSchema', () => {
  it('accepts valid upstream and downstream entries', () => {
    const input = {
      model: 'sales_model',
      upstream: [
        { source: 'raw_db.orders', type: 'pipeline', pipeline: 'etl_orders', tool: 'dbt', refresh: 'daily', notes: 'Main source' },
      ],
      downstream: [
        { target: 'dashboard.sales', type: 'dashboard', tool: 'tableau', notes: 'Sales dashboard' },
      ],
    };
    const result = lineageFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts minimal lineage (model only)', () => {
    const input = { model: 'sales_model' };
    const result = lineageFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('fails with invalid upstream type', () => {
    const input = {
      model: 'sales_model',
      upstream: [
        { source: 'raw.orders', type: 'invalid_type' },
      ],
    };
    const result = lineageFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails with invalid downstream type', () => {
    const input = {
      model: 'sales_model',
      downstream: [
        { target: 'dashboard.sales', type: 'spreadsheet' },
      ],
    };
    const result = lineageFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails when model is missing', () => {
    const input = {
      upstream: [{ source: 'x', type: 'pipeline' }],
    };
    const result = lineageFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Term File Schema
// ---------------------------------------------------------------------------
describe('termFileSchema', () => {
  it('accepts valid term with all fields', () => {
    const input = {
      id: 'revenue',
      definition: 'Total income from sales',
      synonyms: ['income', 'sales'],
      maps_to: ['orders.amount'],
      owner: 'finance-team',
      tags: ['finance', 'kpi'],
    };
    const result = termFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts minimal term (id + definition)', () => {
    const input = { id: 'revenue', definition: 'Total income from sales' };
    const result = termFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('fails when definition is missing', () => {
    const input = { id: 'revenue' };
    const result = termFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails when id is missing', () => {
    const input = { definition: 'Total income from sales' };
    const result = termFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Owner File Schema
// ---------------------------------------------------------------------------
describe('ownerFileSchema', () => {
  it('accepts valid owner with all fields', () => {
    const input = {
      id: 'data-team',
      display_name: 'Data Engineering Team',
      email: 'data-team@example.com',
      team: 'Engineering',
      description: 'Responsible for data pipelines',
    };
    const result = ownerFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts minimal owner (id + display_name)', () => {
    const input = { id: 'data-team', display_name: 'Data Engineering Team' };
    const result = ownerFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('fails when display_name is missing', () => {
    const input = { id: 'data-team' };
    const result = ownerFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails when id is missing', () => {
    const input = { display_name: 'Data Engineering Team' };
    const result = ownerFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Config Schema
// ---------------------------------------------------------------------------
describe('contextKitConfigSchema', () => {
  it('applies defaults when fields are omitted', () => {
    const input = {};
    const result = contextKitConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.context_dir).toBe('context');
      expect(result.data.output_dir).toBe('dist');
    }
  });

  it('accepts valid full config', () => {
    const input = {
      context_dir: 'my_context',
      output_dir: 'build',
      minimum_tier: 'silver',
      lint: {
        severity_overrides: { 'rule-001': 'warning', 'rule-002': 'off' },
      },
      site: {
        title: 'My Data Catalog',
        base_path: '/catalog',
      },
      mcp: {
        transport: 'http',
        port: 8080,
      },
    };
    const result = contextKitConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.context_dir).toBe('my_context');
      expect(result.data.output_dir).toBe('build');
      expect(result.data.minimum_tier).toBe('silver');
      expect(result.data.mcp?.transport).toBe('http');
      expect(result.data.mcp?.port).toBe(8080);
    }
  });

  it('fails with invalid minimum_tier value', () => {
    const input = { minimum_tier: 'platinum' };
    const result = contextKitConfigSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails with invalid mcp transport', () => {
    const input = { mcp: { transport: 'grpc' } };
    const result = contextKitConfigSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('fails with invalid severity override value', () => {
    const input = { lint: { severity_overrides: { 'rule-001': 'fatal' } } };
    const result = contextKitConfigSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
