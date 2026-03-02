import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
  compile,
  loadConfig,
  LintEngine,
  ALL_RULES,
  type Diagnostic,
  type Severity,
  type MetadataTier,
} from '@runcontext/core';
import { formatDiagnostics } from '../formatters/pretty.js';
import { formatJson } from '../formatters/json.js';

export const lintCommand = new Command('lint')
  .description('Run all lint rules against context files')
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

      // Run lint engine
      const overrides = config.lint?.severity_overrides as
        | Record<string, Severity | 'off'>
        | undefined;
      const engine = new LintEngine(overrides);
      for (const rule of ALL_RULES) {
        engine.register(rule);
      }
      const lintDiags = engine.run(graph);

      // Merge compile diagnostics with lint diagnostics
      const allDiags: Diagnostic[] = [...compileDiags, ...lintDiags];

      // Enforce minimum_tier policy
      if (config.minimum_tier) {
        const tierOrder: MetadataTier[] = ['none', 'bronze', 'silver', 'gold'];
        const minIdx = tierOrder.indexOf(config.minimum_tier);
        for (const [modelName, score] of graph.tiers) {
          const actualIdx = tierOrder.indexOf(score.tier);
          if (actualIdx < minIdx) {
            allDiags.push({
              ruleId: 'tier/minimum-tier',
              severity: 'error',
              message: `Model "${modelName}" is tier "${score.tier}" but minimum_tier is "${config.minimum_tier}"`,
              location: { file: `model:${modelName}`, line: 1, column: 1 },
              fixable: false,
            });
          }
        }
      }

      // Output results
      if (opts.format === 'json') {
        console.log(formatJson(allDiags));
      } else {
        console.log(formatDiagnostics(allDiags));
      }

      // Exit with code 1 if there are errors
      const hasErrors = allDiags.some((d) => d.severity === 'error');
      if (hasErrors) {
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red(`Lint failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
