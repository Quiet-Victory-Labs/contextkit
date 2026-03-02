import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import {
  compile,
  loadConfig,
  LintEngine,
  ALL_RULES,
  applyFixes,
  type Severity,
} from '@runcontext/core';
import { formatSuccess, formatError } from '../formatters/pretty.js';
import { formatJson } from '../formatters/json.js';

export const fixCommand = new Command('fix')
  .description('Auto-fix lint issues')
  .option('--context-dir <path>', 'Path to context directory')
  .option('--format <type>', 'Output format: pretty or json', 'pretty')
  .option('--dry-run', 'Show what would be fixed without writing files')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);

      // Compile and lint
      const { graph } = await compile({ contextDir, config });

      const overrides = config.lint?.severity_overrides as
        | Record<string, Severity | 'off'>
        | undefined;
      const engine = new LintEngine(overrides);
      for (const rule of ALL_RULES) {
        engine.register(rule);
      }
      const diagnostics = engine.run(graph);

      const fixable = diagnostics.filter((d) => d.fixable);

      if (fixable.length === 0) {
        if (opts.format === 'json') {
          console.log(formatJson({ fixedFiles: [], fixCount: 0 }));
        } else {
          console.log(chalk.green('No fixable issues found.'));
        }
        return;
      }

      // Apply fixes
      const readFile = (filePath: string) =>
        fs.readFileSync(filePath, 'utf-8');
      const fixedFiles = applyFixes(fixable, readFile);

      if (opts.dryRun) {
        if (opts.format === 'json') {
          const entries = [...fixedFiles.entries()].map(([file, content]) => ({
            file,
            content,
          }));
          console.log(
            formatJson({ dryRun: true, fixCount: fixable.length, entries }),
          );
        } else {
          console.log(
            chalk.yellow(`Dry run: ${fixable.length} issue(s) would be fixed in ${fixedFiles.size} file(s):`),
          );
          for (const file of fixedFiles.keys()) {
            console.log(chalk.gray(`  ${file}`));
          }
        }
        return;
      }

      // Write fixed files
      for (const [file, content] of fixedFiles) {
        fs.writeFileSync(file, content, 'utf-8');
      }

      if (opts.format === 'json') {
        console.log(
          formatJson({
            fixedFiles: [...fixedFiles.keys()],
            fixCount: fixable.length,
          }),
        );
      } else {
        console.log(
          formatSuccess(
            `Fixed ${fixable.length} issue(s) in ${fixedFiles.size} file(s).`,
          ),
        );
      }
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
