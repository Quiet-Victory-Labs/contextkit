import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import * as yaml from 'yaml';
import {
  compile,
  loadConfig,
  computeTier,
  createAdapter,
  suggestEnrichments,
  inferSemanticRole,
  inferAggregation,
} from '@runcontext/core';
import type { DataSourceConfig } from '@runcontext/core';
import { parseDbUrl } from './introspect.js';

/**
 * Recursively search a directory for a file matching a glob-like pattern.
 * Returns the first match or undefined.
 */
function findFileRecursive(dir: string, suffix: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, suffix);
      if (found) return found;
    } else if (entry.name.endsWith(suffix)) {
      return fullPath;
    }
  }
  return undefined;
}

export const enrichCommand = new Command('enrich')
  .description('Suggest or apply metadata enrichments to reach a target tier')
  .option('--target <tier>', 'Target tier: silver or gold', 'silver')
  .option('--apply', 'Write suggestions to YAML files')
  .option('--source <name>', 'Data source for sample values')
  .option('--db <url>', 'Database URL for sample values')
  .option('--context-dir <path>', 'Path to context directory')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);
      const target = opts.target;

      if (!['silver', 'gold'].includes(target)) {
        console.error(chalk.red('--target must be "silver" or "gold"'));
        process.exit(1);
      }

      // Compile graph — follows the pattern from tier command
      const { graph } = await compile({ contextDir, config });

      for (const [modelName] of graph.models) {
        const tierScore = computeTier(modelName, graph);
        console.log(chalk.bold(`${modelName}: ${tierScore.tier.toUpperCase()}`));

        if (tierScore.tier === target || (target === 'silver' && tierScore.tier === 'gold')) {
          console.log(chalk.green(`  Already at ${target} or above.\n`));
          continue;
        }

        const model = graph.models.get(modelName)!;
        const datasetNames = model.datasets.map((d) => d.name);
        const suggestions = suggestEnrichments(target as 'silver' | 'gold', tierScore, datasetNames);

        if (
          !suggestions.governance &&
          !suggestions.lineage &&
          !suggestions.glossaryTerms &&
          !suggestions.needsRulesFile &&
          !suggestions.needsSampleValues &&
          !suggestions.needsSemanticRoles
        ) {
          console.log(chalk.green('  No suggestions needed.\n'));
          continue;
        }

        // Report suggestions
        if (suggestions.governance?.trust) {
          console.log(chalk.yellow(`  + Add trust: ${suggestions.governance.trust}`));
        }
        if (suggestions.governance?.tags) {
          console.log(chalk.yellow(`  + Add tags: [${suggestions.governance.tags.join(', ')}]`));
        }
        if (suggestions.governance?.refreshAll) {
          console.log(chalk.yellow(`  + Add refresh: ${suggestions.governance.refreshAll}`));
        }
        if (suggestions.lineage) {
          console.log(chalk.yellow(`  + Add lineage with ${suggestions.lineage.upstream?.length ?? 0} upstream sources`));
        }
        if (suggestions.glossaryTerms) {
          console.log(chalk.yellow(`  + Generate ${suggestions.glossaryTerms.length} glossary term(s)`));
        }
        if (suggestions.needsSampleValues) {
          console.log(chalk.yellow('  + Populate sample_values from database'));
        }
        if (suggestions.needsSemanticRoles) {
          console.log(chalk.yellow('  + Infer semantic_role for all fields'));
        }
        if (suggestions.needsRulesFile) {
          console.log(chalk.yellow('  + Generate rules file'));
        }

        if (!opts.apply) {
          console.log(chalk.cyan('\n  Run with --apply to write these changes.\n'));
          continue;
        }

        // Apply suggestions to governance YAML
        const govFilePath = findFileRecursive(contextDir, `${modelName}.governance.yaml`);
        if (govFilePath) {
          const govContent = readFileSync(govFilePath, 'utf-8');
          const govDoc = yaml.parse(govContent) ?? {};

          if (suggestions.governance?.trust) {
            govDoc.trust = suggestions.governance.trust;
          }
          if (suggestions.governance?.tags) {
            govDoc.tags = suggestions.governance.tags;
          }
          if (suggestions.governance?.refreshAll) {
            for (const dsName of Object.keys(govDoc.datasets ?? {})) {
              govDoc.datasets[dsName].refresh = suggestions.governance.refreshAll;
            }
          }

          // Infer semantic roles if needed
          if (suggestions.needsSemanticRoles) {
            govDoc.fields = govDoc.fields ?? {};
            let adapter: any = null;
            const dsConfig: DataSourceConfig | undefined = opts.db
              ? parseDbUrl(opts.db)
              : config.data_sources?.[opts.source ?? Object.keys(config.data_sources ?? {})[0]];

            if (dsConfig) {
              adapter = await createAdapter(dsConfig);
              await adapter.connect();
            } else {
              console.log(chalk.yellow('  ! No data source available for semantic role inference. Using name-based heuristics only.'));
            }

            for (const ds of model.datasets) {
              let columns: any[] = [];
              if (adapter) {
                const tableName = ds.source?.split('.').pop() ?? ds.name;
                try {
                  columns = await adapter.listColumns(tableName);
                } catch {
                  // Column introspection failed — fall back to name-based heuristics
                }
              }
              for (const field of ds.fields ?? []) {
                const fieldKey = `${ds.name}.${field.name}`;
                if (govDoc.fields[fieldKey]?.semantic_role) continue;
                const col = columns.find((c: any) => c.name === field.name);
                const isPK = col?.is_primary_key ?? field.name.endsWith('_id');
                const dataType = col?.data_type ?? 'VARCHAR';
                govDoc.fields[fieldKey] = govDoc.fields[fieldKey] ?? {};
                const role = inferSemanticRole(field.name, dataType, isPK);
                govDoc.fields[fieldKey].semantic_role = role;
                if (role === 'metric') {
                  govDoc.fields[fieldKey].default_aggregation = inferAggregation(field.name);
                  govDoc.fields[fieldKey].additive = govDoc.fields[fieldKey].default_aggregation === 'SUM';
                }
              }
            }

            if (adapter) await adapter.disconnect();
          }

          // Populate sample values if needed
          if (suggestions.needsSampleValues) {
            govDoc.fields = govDoc.fields ?? {};
            const dsConfig2: DataSourceConfig | undefined = opts.db
              ? parseDbUrl(opts.db)
              : config.data_sources?.[opts.source ?? Object.keys(config.data_sources ?? {})[0]];

            if (dsConfig2) {
              const adapter2 = await createAdapter(dsConfig2);
              await adapter2.connect();
              let count = 0;
              for (const ds of model.datasets) {
                if (count >= 2) break;
                const tableName = ds.source?.split('.').pop() ?? ds.name;
                for (const field of ds.fields ?? []) {
                  if (count >= 2) break;
                  const fieldKey = `${ds.name}.${field.name}`;
                  if (govDoc.fields[fieldKey]?.sample_values?.length > 0) continue;
                  try {
                    const result = await adapter2.query(
                      `SELECT DISTINCT CAST("${field.name}" AS VARCHAR) AS val FROM "${tableName}" WHERE "${field.name}" IS NOT NULL LIMIT 5`,
                    );
                    if (result.rows.length > 0) {
                      govDoc.fields[fieldKey] = govDoc.fields[fieldKey] ?? {};
                      govDoc.fields[fieldKey].sample_values = result.rows.map((r: any) => String(r.val));
                      count++;
                    }
                  } catch {
                    // Query failed — skip this field
                  }
                }
              }
              await adapter2.disconnect();
            } else {
              console.log(chalk.yellow('  ! No data source available for sample_values. Add data_sources to runcontext.config.yaml or use --db <url>.'));
            }
          }

          writeFileSync(govFilePath, yaml.stringify(govDoc, { lineWidth: 120 }), 'utf-8');
          console.log(chalk.green(`  Updated: ${path.relative(process.cwd(), govFilePath)}`));
        }

        // Write lineage file
        if (suggestions.lineage) {
          const lineageDir = path.join(contextDir, 'lineage');
          if (!existsSync(lineageDir)) mkdirSync(lineageDir, { recursive: true });
          const lineagePath = path.join(lineageDir, `${modelName}.lineage.yaml`);
          if (!existsSync(lineagePath)) {
            const lineageDoc = {
              model: modelName,
              upstream: suggestions.lineage.upstream,
            };
            writeFileSync(lineagePath, yaml.stringify(lineageDoc, { lineWidth: 120 }), 'utf-8');
            console.log(chalk.green(`  Created: ${path.relative(process.cwd(), lineagePath)}`));
          }
        }

        // Write glossary terms
        if (suggestions.glossaryTerms) {
          const glossaryDir = path.join(contextDir, 'glossary');
          if (!existsSync(glossaryDir)) mkdirSync(glossaryDir, { recursive: true });
          for (const term of suggestions.glossaryTerms) {
            const termPath = path.join(glossaryDir, `${term.id}.term.yaml`);
            if (!existsSync(termPath)) {
              writeFileSync(termPath, yaml.stringify(term, { lineWidth: 120 }), 'utf-8');
              console.log(chalk.green(`  Created: ${path.relative(process.cwd(), termPath)}`));
            }
          }
        }

        // Stub rules file
        if (suggestions.needsRulesFile) {
          const rulesDir = path.join(contextDir, 'rules');
          if (!existsSync(rulesDir)) mkdirSync(rulesDir, { recursive: true });
          const rulesPath = path.join(rulesDir, `${modelName}.rules.yaml`);
          if (!existsSync(rulesPath)) {
            const rulesDoc = {
              model: modelName,
              golden_queries: [
                { question: 'TODO: What is the total count?', sql: 'SELECT COUNT(*) FROM table_name' },
                { question: 'TODO: What are the top records?', sql: 'SELECT * FROM table_name LIMIT 10' },
                { question: 'TODO: What is the distribution?', sql: 'SELECT column, COUNT(*) FROM table_name GROUP BY column' },
              ],
              business_rules: [
                { name: 'TODO: rule-name', definition: 'TODO: describe the business rule' },
              ],
              guardrail_filters: [
                { name: 'TODO: filter-name', filter: 'column IS NOT NULL', reason: 'TODO: explain why' },
              ],
              hierarchies: [
                { name: 'TODO: hierarchy-name', levels: ['level1', 'level2'], dataset: datasetNames[0] ?? 'dataset' },
              ],
            };
            writeFileSync(rulesPath, yaml.stringify(rulesDoc, { lineWidth: 120 }), 'utf-8');
            console.log(chalk.green(`  Created: ${path.relative(process.cwd(), rulesPath)} (with TODOs)`));
          }
        }

        console.log('');
      }
    } catch (err) {
      console.error(chalk.red(`Enrich failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
