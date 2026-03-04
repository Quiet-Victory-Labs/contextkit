import * as yaml from 'yaml';
import type { TableInfo, ColumnInfo } from '../adapters/types.js';
import { inferTableType, inferGrain } from './heuristics.js';

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

    return {
      name: table.name,
      description: `${table.type === 'view' ? 'View' : 'Table'}: ${table.name} (${table.row_count.toLocaleString()} rows)`,
      source: `${dataSourceName}.main.${table.name}`,
      data_source: dataSourceName,
      ...(pkCols.length > 0 ? { primary_key: pkCols } : {}),
      fields: cols.map((col) => ({
        name: col.name,
        description: col.name,
        expression: {
          dialects: [{ dialect: 'ANSI_SQL', expression: col.name }],
        },
      })),
    };
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
    govDatasets[table.name] = {
      grain: inferGrain(table.name, cols),
      table_type: inferTableType(table.name, table.type, cols),
    };
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
