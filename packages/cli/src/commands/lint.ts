import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  compile,
  loadConfigAsync,
  LintEngine,
  ALL_RULES,
  filterByDirectives,
  applyFixes,
  loadPlugins,
  computeCacheHash,
  readCache,
  writeCache,
  type Diagnostic,
  type Severity,
  type MetadataTier,
} from '@runcontext/core';
import { formatDiagnostics } from '../formatters/pretty.js';
import { formatJson } from '../formatters/json.js';
import { formatSarif } from '../formatters/sarif.js';
import { formatGitHub } from '../formatters/github.js';
import { formatJUnit } from '../formatters/junit.js';

type FormatType = 'pretty' | 'json' | 'sarif' | 'github' | 'junit';

const VALID_FORMATS: FormatType[] = ['pretty', 'json', 'sarif', 'github', 'junit'];

/**
 * Detect the best default format based on CI environment.
 */
function detectFormat(): FormatType {
  if (process.env.GITHUB_ACTIONS) return 'github';
  if (process.env.CI) return 'json';
  return 'pretty';
}

/**
 * Parse --rule overrides: "ruleId:severity" pairs.
 * Accumulates across multiple --rule flags.
 */
function collectRule(value: string, previous: Record<string, string>): Record<string, string> {
  const lastColon = value.lastIndexOf(':');
  if (lastColon === -1) {
    throw new Error(`Invalid --rule format: "${value}". Expected "ruleId:severity" (e.g., "governance/grain-required:error")`);
  }
  const ruleId = value.slice(0, lastColon);
  const severity = value.slice(lastColon + 1);
  if (!['error', 'warning', 'off'].includes(severity)) {
    throw new Error(`Invalid severity "${severity}" in --rule "${value}". Must be error, warning, or off.`);
  }
  previous[ruleId] = severity;
  return previous;
}

/**
 * Format diagnostics using the specified format.
 */
function formatOutput(diagnostics: Diagnostic[], format: FormatType): string {
  switch (format) {
    case 'json':
      return formatJson(diagnostics);
    case 'sarif':
      return formatSarif(diagnostics);
    case 'github':
      return formatGitHub(diagnostics);
    case 'junit':
      return formatJUnit(diagnostics);
    case 'pretty':
    default:
      return formatDiagnostics(diagnostics);
  }
}

export const lintCommand = new Command('lint')
  .description('Run all lint rules against context files')
  .option('--context-dir <path>', 'Path to context directory')
  .option('--format <type>', `Output format: ${VALID_FORMATS.join(', ')}`)
  .option('--max-warnings <count>', 'Exit with error if warning count exceeds this threshold', parseInt)
  .option('--output-file <path>', 'Write formatted output to a file')
  .option('--rule <ruleId:severity>', 'Override rule severity (repeatable)', collectRule, {})
  .option('--fix', 'Automatically fix problems')
  .option('--fix-dry-run', 'Show what --fix would change without writing')
  .option('--cache', 'Only lint changed files (uses .runcontext-cache)')
  .option('--no-cache', 'Bypass the lint cache')
  .action(async (opts) => {
    try {
      const config = await loadConfigAsync(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);
      const rootDir = process.cwd();

      // Determine output format (explicit flag > CI auto-detect)
      const format: FormatType = opts.format
        ? (VALID_FORMATS.includes(opts.format) ? opts.format : 'pretty')
        : detectFormat();

      // Check cache if --cache is enabled
      const useCache = opts.cache === true;
      if (useCache) {
        const configContent = JSON.stringify(config) + JSON.stringify(opts.rule ?? {});
        const hash = computeCacheHash(contextDir, configContent);
        const cached = readCache(rootDir, hash);
        if (cached) {
          const output = formatOutput(cached, format);
          if (opts.outputFile) {
            writeFileSync(path.resolve(opts.outputFile), output, 'utf-8');
            const ec = cached.filter((d) => d.severity === 'error').length;
            const wc = cached.filter((d) => d.severity === 'warning').length;
            console.log(`Results written to ${opts.outputFile} (${ec} error(s), ${wc} warning(s)) (cached)`);
          } else {
            console.log(output);
          }
          const hasErrors = cached.some((d) => d.severity === 'error');
          if (hasErrors) process.exit(1);
          return;
        }
      }

      // Compile the context graph
      const { graph, diagnostics: compileDiags, directives } = await compile({
        contextDir,
        config,
        rootDir,
      });

      // Merge severity overrides: config file + CLI --rule overrides (CLI wins)
      const configOverrides = (config.lint?.severity_overrides ?? {}) as Record<string, Severity | 'off'>;
      const cliOverrides = opts.rule as Record<string, string>;
      const overrides: Record<string, Severity | 'off'> = {
        ...configOverrides,
        ...cliOverrides as Record<string, Severity | 'off'>,
      };

      // Run lint engine with built-in + plugin rules
      const engine = new LintEngine(Object.keys(overrides).length > 0 ? overrides : undefined);
      for (const rule of ALL_RULES) {
        engine.register(rule);
      }
      if (config.plugins && config.plugins.length > 0) {
        const pluginRules = await loadPlugins(config.plugins);
        for (const rule of pluginRules) {
          engine.register(rule);
        }
      }
      const lintDiags = engine.run(graph);

      // Merge compile diagnostics with lint diagnostics, then filter by inline directives
      let allDiags: Diagnostic[] = filterByDirectives(
        [...compileDiags, ...lintDiags],
        directives,
      );

      // Apply auto-fixes if --fix or --fix-dry-run
      if (opts.fix || opts.fixDryRun) {
        const fixable = allDiags.filter((d) => d.fixable && d.fix);
        if (fixable.length > 0) {
          const fixes = applyFixes(fixable, (filePath) => readFileSync(filePath, 'utf-8'));

          if (opts.fixDryRun) {
            console.log(chalk.blue(`Would fix ${fixable.length} issue(s) in ${fixes.size} file(s):`));
            for (const [file] of fixes) {
              console.log(chalk.gray(`  ${file}`));
            }
            console.log('');
          } else {
            // Write fixes to disk
            for (const [file, content] of fixes) {
              writeFileSync(file, content, 'utf-8');
            }
            console.log(chalk.green(`Fixed ${fixable.length} issue(s) in ${fixes.size} file(s).`));

            // Re-lint to show remaining issues
            const { graph: reGraph, diagnostics: reCompileDiags, directives: reDirs } = await compile({
              contextDir,
              config,
              rootDir: process.cwd(),
            });
            const reEngine = new LintEngine(Object.keys(overrides).length > 0 ? overrides : undefined);
            for (const rule of ALL_RULES) {
              reEngine.register(rule);
            }
            const reLintDiags = reEngine.run(reGraph);
            allDiags = filterByDirectives([...reCompileDiags, ...reLintDiags], reDirs);
          }
        }
      }

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

      // Write cache if enabled
      if (useCache) {
        const configContent = JSON.stringify(config) + JSON.stringify(opts.rule ?? {});
        const hash = computeCacheHash(contextDir, configContent);
        writeCache(rootDir, hash, allDiags);
      }

      // Format output
      const output = formatOutput(allDiags, format);

      // Write to file if --output-file specified
      if (opts.outputFile) {
        writeFileSync(path.resolve(opts.outputFile), output, 'utf-8');
        // Print summary to stdout
        const errorCount = allDiags.filter((d) => d.severity === 'error').length;
        const warnCount = allDiags.filter((d) => d.severity === 'warning').length;
        console.log(`Results written to ${opts.outputFile} (${errorCount} error(s), ${warnCount} warning(s))`);
      } else {
        console.log(output);
      }

      // Check --max-warnings threshold
      const warnCount = allDiags.filter((d) => d.severity === 'warning').length;
      if (opts.maxWarnings !== undefined && !isNaN(opts.maxWarnings) && warnCount > opts.maxWarnings) {
        console.error(
          chalk.red(`Too many warnings: ${warnCount} (max allowed: ${opts.maxWarnings})`),
        );
        process.exit(1);
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
