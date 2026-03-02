import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import {
  loadConfig,
  compile,
  LintEngine,
  ALL_RULES,
  applyFixes,
} from '@runcontext/core';
import type { Diagnostic, Severity } from '@runcontext/core';
import { formatDiagnostics } from '../formatters/pretty.js';
import { formatDiagnosticsJson } from '../formatters/json.js';

export const fixCommand = new Command('fix')
  .description('Apply autofixes to context files')
  .option('--write', 'write fixes to disk (default: dry-run)')
  .option('--format <format>', 'output format for diagnostics (pretty|json)', 'pretty')
  .action(async (opts: { write?: boolean; format: string }) => {
    try {
      const config = await loadConfig(process.cwd());

      const rootDir = config.paths?.rootDir || process.cwd();
      const contextDir = path.resolve(rootDir, config.paths?.contextDir || 'context');

      // Compile context files
      const { graph, diagnostics: compileDiags } = await compile({ contextDir, config });

      // Run lint engine
      const engine = new LintEngine(config.lint?.rules as Record<string, Severity | 'off'> | undefined);
      for (const rule of ALL_RULES) {
        engine.register(rule);
      }
      const lintDiags = engine.run(graph);

      // Merge diagnostics
      const allDiags: Diagnostic[] = [...compileDiags, ...lintDiags];

      // Separate fixable from unfixable
      const fixableDiags = allDiags.filter((d) => d.fixable && d.fix);
      const unfixableDiags = allDiags.filter((d) => !d.fixable || !d.fix);

      if (fixableDiags.length === 0) {
        console.log(chalk.green('No fixable issues found.'));
        if (unfixableDiags.length > 0) {
          console.log('');
          console.log(chalk.yellow(`${unfixableDiags.length} unfixable issue(s) remain:`));
          const output =
            opts.format === 'json'
              ? formatDiagnosticsJson(unfixableDiags)
              : formatDiagnostics(unfixableDiags);
          console.log(output);
          const hasErrors = unfixableDiags.some((d) => d.severity === 'error');
          if (hasErrors) {
            process.exit(1);
          }
        }
        return;
      }

      // Apply fixes
      const results = applyFixes(fixableDiags);

      if (opts.write) {
        // Write fixes to disk
        for (const result of results) {
          fs.writeFileSync(result.file, result.newContent, 'utf-8');
        }

        const totalEdits = results.reduce((sum, r) => sum + r.editsApplied, 0);
        console.log(
          chalk.green(`Fixed ${totalEdits} issue(s) in ${results.length} file(s).`)
        );

        // Report remaining unfixable issues
        if (unfixableDiags.length > 0) {
          console.log('');
          console.log(chalk.yellow(`${unfixableDiags.length} unfixable issue(s) remain:`));
          const output =
            opts.format === 'json'
              ? formatDiagnosticsJson(unfixableDiags)
              : formatDiagnostics(unfixableDiags);
          console.log(output);
        }
      } else {
        // Dry-run mode: show what would be fixed
        console.log(chalk.cyan('Dry run — no files changed. Use --write to apply fixes.\n'));

        console.log(chalk.bold(`${fixableDiags.length} fixable issue(s) found:\n`));

        for (const diag of fixableDiags) {
          const location = `${diag.source.file}:${diag.source.line}:${diag.source.col}`;
          const severityLabel =
            diag.severity === 'error'
              ? chalk.red('error')
              : chalk.yellow('warning');
          console.log(`  ${location}  ${severityLabel}  ${chalk.dim(diag.ruleId)}  ${diag.message}`);
          if (diag.fix) {
            console.log(`    ${chalk.green('fix:')} ${diag.fix.description}`);
          }
        }

        console.log('');
        console.log(
          `Would fix ${results.reduce((s, r) => s + r.editsApplied, 0)} issue(s) in ${results.length} file(s).`
        );

        if (unfixableDiags.length > 0) {
          console.log('');
          console.log(chalk.yellow(`${unfixableDiags.length} unfixable issue(s) would remain.`));
        }
      }

      // Exit with error if unfixable errors remain
      const hasUnfixableErrors = unfixableDiags.some((d) => d.severity === 'error');
      if (hasUnfixableErrors) {
        process.exit(1);
      }
    } catch (err) {
      console.error('Fix failed:', (err as Error).message);
      process.exit(1);
    }
  });
