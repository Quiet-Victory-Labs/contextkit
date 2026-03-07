import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Manifest } from '@runcontext/core';
import { buildModelView } from './model.js';

const DATA_PRODUCT_TEMPLATE = `# data-product.osi.yaml
# AI Blueprint — Open Semantic Interchange (OSI) v1.0
# The complete semantic spec for a data product, ready for any AI agent.
# Fill in the sections below to describe your data model.

osi_version: "1.0"

semantic_model:
  name: my_data_product
  description: >
    Describe the purpose and scope of this data product.

  # ── Governance ──────────────────────────────────────────────
  owner: team-name
  tier: bronze          # bronze | silver | gold
  trust_status: draft   # draft | reviewed | verified
  grain: One row per ...
  tags: []

  # ── Glossary ────────────────────────────────────────────────
  glossary: []
  #  - term: Business Term
  #    definition: What this term means in your organization.
  #    related_fields:
  #      - dataset_name.field_name

  # ── Datasets ────────────────────────────────────────────────
  datasets:
    - name: example_table
      description: Describe this table
      schema: public
      table: example_table
      grain: primary_key_column
      fields:
        - name: id
          expression: id
          description: Primary key
          semantic_role: identifier

        - name: created_at
          expression: created_at
          description: Row creation timestamp
          semantic_role: time

        # Add more fields...

  # ── Relationships ───────────────────────────────────────────
  relationships: []
  #  - name: table_a_to_table_b
  #    from:
  #      dataset: table_a
  #      columns: [foreign_key]
  #    to:
  #      dataset: table_b
  #      columns: [primary_key]
  #    cardinality: many_to_one

  # ── Metrics ─────────────────────────────────────────────────
  metrics: []
  #  - name: total_revenue
  #    expression: SUM(amount)
  #    description: Total revenue
  #    ai_context:
  #      instructions: Always filter to completed transactions.
  #      synonyms: [revenue, sales]

  # ── Golden Queries ──────────────────────────────────────────
  golden_queries: []
  #  - name: example_query
  #    description: What this query answers
  #    sql: |
  #      SELECT ...
  #    verified: false
`;

/**
 * Register the `context://data-product/template` resource.
 * Returns a blank OSI-compliant data product YAML template.
 */
export function registerDataProductResource(server: McpServer, manifest: Manifest): void {
  // Static resource: blank template
  server.resource(
    'data-product-template',
    'context://data-product/template',
    { description: 'Blank AI Blueprint template — use as a starting point for new data products (OSI v1.0)' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/yaml',
          text: DATA_PRODUCT_TEMPLATE,
        },
      ],
    }),
  );

  // Dynamic resource: export a model as a data product YAML
  server.resource(
    'data-product',
    new ResourceTemplate('context://data-product/{name}', {
      list: async () => ({
        resources: Object.keys(manifest.models).map((name) => ({
          uri: `context://data-product/${name}`,
          name: `${name} AI Blueprint`,
          description: `AI Blueprint for ${name} — full semantic spec as portable OSI YAML`,
        })),
      }),
    }),
    { description: 'Export a data product as an AI Blueprint — the complete semantic spec in portable OSI YAML' },
    async (uri, { name }) => {
      const modelName = String(name);
      const view = buildModelView(modelName, manifest);
      if (!view) {
        throw new Error(`Model '${modelName}' not found`);
      }

      const yaml = modelViewToYaml(modelName, view, manifest);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/yaml',
            text: yaml,
          },
        ],
      };
    },
  );
}

/**
 * Convert a model view into an OSI-compliant data product YAML string.
 */
function modelViewToYaml(name: string, view: Record<string, unknown>, manifest: Manifest): string {
  const model = view.model as Record<string, unknown> | undefined;
  const governance = view.governance as Record<string, unknown> | undefined;
  const rules = view.rules as Record<string, unknown> | undefined;
  const tier = view.tier as Record<string, unknown> | undefined;

  const lines: string[] = [
    `# ${name}.data-product.osi.yaml`,
    `# AI Blueprint — Open Semantic Interchange (OSI) v1.0`,
    `# Exported from ContextKit`,
    ``,
    `osi_version: "1.0"`,
    ``,
    `semantic_model:`,
    `  name: ${name}`,
  ];

  if (model && typeof model === 'object') {
    const desc = (model as Record<string, unknown>).description;
    if (desc) lines.push(`  description: ${JSON.stringify(String(desc))}`);
  }

  if (governance) {
    const gov = governance as Record<string, unknown>;
    if (gov.owner) lines.push(`  owner: ${gov.owner}`);
    if (gov.trust_status) lines.push(`  trust_status: ${gov.trust_status}`);
  }

  if (tier) {
    const t = tier as Record<string, unknown>;
    if (t.current) lines.push(`  tier: ${t.current}`);
  }

  // Glossary
  const terms = manifest.terms;
  if (terms && Object.keys(terms).length > 0) {
    lines.push(``, `  glossary:`);
    for (const [termName, termDef] of Object.entries(terms)) {
      const def = termDef as unknown as Record<string, unknown>;
      lines.push(`    - term: ${termName}`);
      if (def.definition) lines.push(`      definition: ${JSON.stringify(String(def.definition))}`);
    }
  }

  // Datasets (from model)
  if (model) {
    const m = model as Record<string, unknown>;
    const datasets = m.datasets as Array<Record<string, unknown>> | undefined;
    if (datasets && datasets.length > 0) {
      lines.push(``, `  datasets:`);
      for (const ds of datasets) {
        lines.push(`    - name: ${ds.name}`);
        if (ds.description) lines.push(`      description: ${JSON.stringify(String(ds.description))}`);
        if (ds.schema) lines.push(`      schema: ${ds.schema}`);
        if (ds.table) lines.push(`      table: ${ds.table}`);

        const fields = ds.fields as Array<Record<string, unknown>> | undefined;
        if (fields && fields.length > 0) {
          lines.push(`      fields:`);
          for (const f of fields) {
            lines.push(`        - name: ${f.name}`);
            if (f.expression) lines.push(`          expression: ${f.expression}`);
            if (f.description) lines.push(`          description: ${JSON.stringify(String(f.description))}`);
            if (f.semantic_role) lines.push(`          semantic_role: ${f.semantic_role}`);
            if (f.dimension) lines.push(`          dimension: true`);
            if (f.label) lines.push(`          label: true`);
          }
        }
      }
    }

    // Relationships
    const rels = m.relationships as Array<Record<string, unknown>> | undefined;
    if (rels && rels.length > 0) {
      lines.push(``, `  relationships:`);
      for (const r of rels) {
        lines.push(`    - name: ${r.name}`);
        const from = r.from as Record<string, unknown> | undefined;
        const to = r.to as Record<string, unknown> | undefined;
        if (from) {
          lines.push(`      from:`);
          lines.push(`        dataset: ${from.dataset}`);
          if (from.columns) lines.push(`        columns: ${JSON.stringify(from.columns)}`);
        }
        if (to) {
          lines.push(`      to:`);
          lines.push(`        dataset: ${to.dataset}`);
          if (to.columns) lines.push(`        columns: ${JSON.stringify(to.columns)}`);
        }
      }
    }

    // Metrics
    const metrics = m.metrics as Array<Record<string, unknown>> | undefined;
    if (metrics && metrics.length > 0) {
      lines.push(``, `  metrics:`);
      for (const met of metrics) {
        lines.push(`    - name: ${met.name}`);
        if (met.expression) lines.push(`      expression: ${met.expression}`);
        if (met.description) lines.push(`      description: ${JSON.stringify(String(met.description))}`);
      }
    }
  }

  // Business rules
  if (rules && typeof rules === 'object') {
    const ruleEntries = Object.entries(rules);
    if (ruleEntries.length > 0) {
      lines.push(``, `  business_rules:`);
      for (const [ruleName, ruleDef] of ruleEntries) {
        const r = ruleDef as Record<string, unknown>;
        lines.push(`    - name: ${ruleName}`);
        if (r.description) lines.push(`      description: ${JSON.stringify(String(r.description))}`);
        if (r.rule) lines.push(`      rule: ${JSON.stringify(String(r.rule))}`);
      }
    }
  }

  // Golden queries from rules
  if (rules && typeof rules === 'object') {
    const r = rules as Record<string, unknown>;
    const goldenQueries = r.golden_queries as Array<Record<string, unknown>> | undefined;
    if (goldenQueries && goldenQueries.length > 0) {
      lines.push(``, `  golden_queries:`);
      for (const gq of goldenQueries) {
        lines.push(`    - name: ${gq.name}`);
        if (gq.description) lines.push(`      description: ${JSON.stringify(String(gq.description))}`);
        if (gq.sql) {
          lines.push(`      sql: |`);
          const sqlLines = String(gq.sql).split('\n');
          for (const sl of sqlLines) {
            lines.push(`        ${sl}`);
          }
        }
        lines.push(`      verified: ${gq.verified ?? false}`);
      }
    }
  }

  lines.push(``);
  return lines.join('\n');
}
