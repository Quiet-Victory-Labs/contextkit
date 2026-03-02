import { Command } from 'commander';
import path from 'node:path';
import {
  loadConfig,
  compile,
  LintEngine,
  ALL_RULES,
} from '@runcontext/core';
import type { Diagnostic, Severity } from '@runcontext/core';
import { formatDiagnostics } from '../formatters/pretty.js';
import { formatDiagnosticsJson } from '../formatters/json.js';

export const lintCommand = new Command('lint')
  .description('Lint context files and report diagnostics')
  .option('--format <format>', 'output format (pretty|json)', 'pretty')
  .option('--fix', 'apply autofixes (placeholder)')
  .action(async (opts: { format: string; fix?: boolean }) => {
    if (opts.fix) {
      console.log("Use 'context fix' for autofixes.");
      return;
    }

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

      // Format output
      const output =
        opts.format === 'json'
          ? formatDiagnosticsJson(allDiags)
          : formatDiagnostics(allDiags);
      console.log(output);

      // Exit with error if any errors found
      const hasErrors = allDiags.some((d) => d.severity === 'error');
      if (hasErrors) {
        process.exit(1);
      }
    } catch (err) {
      console.error('Lint failed:', (err as Error).message);
      process.exit(1);
    }
  });
