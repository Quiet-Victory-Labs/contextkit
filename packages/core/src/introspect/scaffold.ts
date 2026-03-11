import * as yaml from 'yaml';
import type { TableInfo, ColumnInfo } from '../adapters/types.js';
import { inferTableType, inferGrain, inferRelationships, inferGuardrails } from './heuristics.js';

export interface ScaffoldInput {
  modelName: string;
  dataSourceName: string;
  tables: TableInfo[];
  columns: Record<string, ColumnInfo[]>;
}

export interface ScaffoldResult {
  osiYaml: string;
  governanceYaml: string;
  ownerYaml: string;
  files: {
    osi: string;
    governance: string;
    owner: string;
  };
}

export function scaffoldFromSchema(input: ScaffoldInput): ScaffoldResult {
  const { modelName, dataSourceName, tables, columns } = input;

  // Build OSI model
  const datasets = tables.map((table) => {
    const cols = columns[table.name] ?? [];
    const pkCols = cols.filter((c) => c.is_primary_key).map((c) => c.name);

    // Build field metadata from rich column info
    const fields = cols.map((col) => {
      const field: Record<string, any> = {
        name: col.name,
        description: col.comment || col.name,
        expression: {
          dialects: [{ dialect: 'ANSI_SQL', expression: col.name }],
        },
      };

      // Add FK relationship info
      if (col.is_foreign_key && col.referenced_table) {
        field.references = `${col.referenced_table}.${col.referenced_column}`;
      }

      // Add enum values as allowed_values
      if (col.enum_values && col.enum_values.length > 0) {
        field.allowed_values = col.enum_values;
      }

      return field;
    });

    const dataset: Record<string, any> = {
      name: table.name,
      description: table.comment || `${table.type === 'view' ? 'View' : 'Table'}: ${table.name} (${table.row_count.toLocaleString()} rows)`,
      source: `${dataSourceName}.${table.schema ?? 'main'}.${table.name}`,
      data_source: dataSourceName,
      ...(pkCols.length > 0 ? { primary_key: pkCols } : {}),
      fields,
    };

    // Add relationships derived from FKs
    const relationships = inferRelationships(table.name, cols);
    if (relationships.length > 0) {
      dataset.relationships = relationships.map((r) => ({
        field: r.column,
        references: `${r.references}.${r.referenced_column}`,
        type: 'many_to_one',
      }));
    }

    // Add partition info if available
    if (table.partition_key) {
      dataset.partition_key = table.partition_key;
    }

    return dataset;
  });

  const osiDoc = {
    version: '1.0',
    semantic_model: [
      {
        name: modelName,
        description: `Semantic model scaffolded from ${dataSourceName}`,
        datasets,
      },
    ],
  };

  // Build governance
  const govDatasets: Record<string, any> = {};
  for (const table of tables) {
    const cols = columns[table.name] ?? [];
    const govEntry: Record<string, any> = {
      grain: inferGrain(table.name, cols),
      table_type: inferTableType(table.name, table.type, cols),
    };

    // Add guardrails from check constraints and enums
    const guardrails = inferGuardrails(table, cols);
    if (guardrails.length > 0) {
      govEntry.guardrails = guardrails;
    }

    // Add indexes info for query optimization hints
    if (table.indexes && table.indexes.length > 0) {
      govEntry.indexes = table.indexes.map((idx) => ({
        name: idx.name,
        columns: idx.columns,
        unique: idx.is_unique,
      }));
    }

    govDatasets[table.name] = govEntry;
  }

  const govDoc = {
    model: modelName,
    owner: 'default-team',
    security: 'internal',
    datasets: govDatasets,
  };

  // Build owner
  const ownerDoc = {
    id: 'default-team',
    display_name: 'Default Team',
  };

  return {
    osiYaml: yaml.stringify(osiDoc, { lineWidth: 120 }),
    governanceYaml: yaml.stringify(govDoc, { lineWidth: 120 }),
    ownerYaml: yaml.stringify(ownerDoc, { lineWidth: 120 }),
    files: {
      osi: `${modelName}.osi.yaml`,
      governance: `${modelName}.governance.yaml`,
      owner: 'default-team.owner.yaml',
    },
  };
}
