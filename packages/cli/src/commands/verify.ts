import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
  compile,
  loadConfig,
  LintEngine,
  ALL_RULES,
  createAdapter,
  type ContextGraph,
  type DataValidationInfo,
  type DataAdapter,
  type DataSourceConfig,
  type Diagnostic,
  type FieldGovernance,
} from '@runcontext/core';
import { formatDiagnostics } from '../formatters/pretty.js';
import { parseDbUrl } from './introspect.js';

/**
 * Resolve a dataset name to an actual table name in the database.
 */
function findTable(
  dsName: string,
  graph: ContextGraph,
  existingTables: Map<string, number>,
): string | undefined {
  if (existingTables.has(dsName)) return dsName;
  for (const [, model] of graph.models) {
    const ds = model.datasets.find((d) => d.name === dsName);
    if (ds?.source) {
      const tableName = ds.source.split('.').pop()!;
      if (existingTables.has(tableName)) return tableName;
    }
  }
  return undefined;
}

/**
 * Introspect the database and collect validation data for the graph.
 */
export async function collectDataValidation(
  adapter: DataAdapter,
  graph: ContextGraph,
): Promise<DataValidationInfo> {
  const validation: DataValidationInfo = {
    existingTables: new Map(),
    existingColumns: new Map(),
    actualSampleValues: new Map(),
    goldenQueryResults: new Map(),
    guardrailResults: new Map(),
  };

  // 1. List all tables with row counts
  const tables = await adapter.listTables();
  for (const t of tables) {
    validation.existingTables.set(t.name, t.row_count);
  }

  // 2. List columns for all discovered tables
  for (const t of tables) {
    const cols = await adapter.listColumns(t.name);
    const colMap = new Map(cols.map((c) => [c.name, c.data_type]));
    validation.existingColumns.set(t.name, colMap);
  }

  // 3. Collect sample values for governance fields
  for (const [, gov] of graph.governance) {
    if (!gov.fields) continue;
    for (const [fieldKey, fieldGov] of Object.entries(gov.fields) as [string, FieldGovernance][]) {
      if (!fieldGov.sample_values || fieldGov.sample_values.length === 0)
        continue;
      const dotIdx = fieldKey.indexOf('.');
      if (dotIdx < 0) continue;
      const dsName = fieldKey.substring(0, dotIdx);
      const fieldName = fieldKey.substring(dotIdx + 1);
      const tableName = findTable(dsName, graph, validation.existingTables);
      if (!tableName) continue;
      try {
        const result = await adapter.query(
          `SELECT DISTINCT CAST("${fieldName}" AS VARCHAR) AS val FROM "${tableName}" WHERE "${fieldName}" IS NOT NULL LIMIT 50`,
        );
        validation.actualSampleValues.set(
          fieldKey,
          result.rows.map((r) => String(r.val)),
        );
      } catch {
        /* skip fields that can't be queried */
      }
    }
  }

  // 4. Execute golden queries
  for (const [, rules] of graph.rules) {
    if (!rules.golden_queries) continue;
    for (let i = 0; i < rules.golden_queries.length; i++) {
      const gq = rules.golden_queries[i]!;
      try {
        const result = await adapter.query(gq.sql);
        validation.goldenQueryResults.set(i, {
          success: true,
          rowCount: result.row_count,
        });
      } catch (err) {
        validation.goldenQueryResults.set(i, {
          success: false,
          error: (err as Error).message,
        });
      }
    }
  }

  // 5. Validate guardrail filter SQL
  for (const [, rules] of graph.rules) {
    if (!rules.guardrail_filters) continue;
    for (let i = 0; i < rules.guardrail_filters.length; i++) {
      const gf = rules.guardrail_filters[i]!;
      const testTable = gf.tables?.[0] ?? 'unknown';
      const tableName = findTable(testTable, graph, validation.existingTables);
      if (!tableName) {
        validation.guardrailResults.set(i, {
          valid: false,
          error: `Table "${testTable}" not found`,
        });
        continue;
      }
      try {
        await adapter.query(
          `SELECT 1 FROM "${tableName}" WHERE ${gf.filter} LIMIT 1`,
        );
        validation.guardrailResults.set(i, { valid: true });
      } catch (err) {
        validation.guardrailResults.set(i, {
          valid: false,
          error: (err as Error).message,
        });
      }
    }
  }

  return validation;
}

export const verifyCommand = new Command('verify')
  .description('Validate metadata accuracy against a live database')
  .option('--source <name>', 'Use a specific data_source from config')
  .option('--db <url>', 'Database URL override (postgres:// or path.duckdb)')
  .option('--context-dir <path>', 'Path to context directory')
  .option('--format <type>', 'Output format: pretty or json', 'pretty')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);

      // Compile the context graph
      const { graph, diagnostics: compileDiags } = await compile({
        contextDir,
        config,
      });

      // Resolve data source configuration
      let dsConfig: DataSourceConfig;
      if (opts.db) {
        dsConfig = parseDbUrl(opts.db);
      } else {
        const sources = config.data_sources;
        if (!sources || Object.keys(sources).length === 0) {
          console.error(
            chalk.red(
              'No data source configured. Add data_sources to runcontext.config.yaml or use --db.',
            ),
          );
          process.exit(1);
        }
        const name = opts.source ?? Object.keys(sources)[0]!;
        const resolved = sources[name];
        if (!resolved) {
          console.error(
            chalk.red(
              `Data source "${name}" not found. Available: ${Object.keys(sources).join(', ')}`,
            ),
          );
          process.exit(1);
          return; // unreachable, but helps TypeScript narrow the type
        }
        dsConfig = resolved;
      }

      // Connect and collect validation data
      const adapter = await createAdapter(dsConfig);
      await adapter.connect();
      console.log(chalk.green(`Connected to ${dsConfig.adapter}`));
      console.log('Collecting validation data...\n');

      graph.dataValidation = await collectDataValidation(adapter, graph);
      await adapter.disconnect();

      // Run only data/* rules
      const engine = new LintEngine();
      for (const rule of ALL_RULES) {
        if (rule.id.startsWith('data/')) {
          engine.register(rule);
        }
      }
      const dataDiags = engine.run(graph);

      // Merge compile errors that are relevant (optional) + data diagnostics
      const allDiags: Diagnostic[] = [...dataDiags];

      // Output results
      if (allDiags.length === 0) {
        const tableCount = graph.dataValidation.existingTables.size;
        const totalRows = [
          ...graph.dataValidation.existingTables.values(),
        ].reduce((a, b) => a + b, 0);
        console.log(chalk.green('All data validation checks passed.\n'));
        console.log(
          `Verified against ${tableCount} table(s) (${totalRows.toLocaleString()} total rows)`,
        );
      } else {
        console.log(formatDiagnostics(allDiags));
      }

      const hasErrors = allDiags.some((d) => d.severity === 'error');
      if (hasErrors) process.exit(1);
    } catch (err) {
      console.error(chalk.red(`Verify failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
