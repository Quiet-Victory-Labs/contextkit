import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  compile,
  loadConfig,
  LintEngine,
  ALL_RULES,
  filterByDirectives,
  applyFixes,
  type Diagnostic,
  type Severity,
} from '@runcontext/core';
import { formatDiagnostics } from '../formatters/pretty.js';
import { brand } from '../brand.js';

/** Serialize a diagnostic to a comparable key. */
function diagKey(d: Diagnostic): string {
  return `${d.ruleId}|${d.location.file}:${d.location.line}:${d.location.column}|${d.message}`;
}

let previousDiags: Map<string, Diagnostic> = new Map();

async function runLint(
  contextDir: string,
  fix: boolean,
): Promise<void> {
  const config = loadConfig(process.cwd());

  const { graph, diagnostics: compileDiags, directives } = await compile({
    contextDir,
    config,
    rootDir: process.cwd(),
  });

  const overrides = config.lint?.severity_overrides as
    | Record<string, Severity | 'off'>
    | undefined;
  const engine = new LintEngine(overrides);
  for (const rule of ALL_RULES) {
    engine.register(rule);
  }
  const lintDiags = engine.run(graph);
  let allDiags = filterByDirectives([...compileDiags, ...lintDiags], directives);

  // Apply fixes in watch mode if --fix
  if (fix) {
    const fixable = allDiags.filter((d) => d.fixable && d.fix);
    if (fixable.length > 0) {
      const fixes = applyFixes(fixable, (filePath) => readFileSync(filePath, 'utf-8'));
      for (const [file, content] of fixes) {
        writeFileSync(file, content, 'utf-8');
      }
      // Re-lint after fixes
      const { graph: reGraph, diagnostics: reCompileDiags, directives: reDirs } = await compile({
        contextDir,
        config,
        rootDir: process.cwd(),
      });
      const reEngine = new LintEngine(overrides);
      for (const rule of ALL_RULES) {
        reEngine.register(rule);
      }
      allDiags = filterByDirectives([...reCompileDiags, ...reEngine.run(reGraph)], reDirs);

      if (fixable.length > 0) {
        console.log(chalk.green(`  Auto-fixed ${fixable.length} issue(s).`));
      }
    }
  }

  // Build current diagnostics map
  const currentDiags = new Map<string, Diagnostic>();
  for (const d of allDiags) {
    currentDiags.set(diagKey(d), d);
  }

  // Compute diff
  const newIssues: Diagnostic[] = [];
  const resolved: Diagnostic[] = [];

  for (const [key, d] of currentDiags) {
    if (!previousDiags.has(key)) newIssues.push(d);
  }
  for (const [key, d] of previousDiags) {
    if (!currentDiags.has(key)) resolved.push(d);
  }

  // Display
  console.clear();
  console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] Linting...`));

  if (previousDiags.size > 0) {
    // Show diff summary
    if (resolved.length > 0) {
      console.log(chalk.green(`  ${resolved.length} issue(s) resolved`));
    }
    if (newIssues.length > 0) {
      console.log(chalk.red(`  ${newIssues.length} new issue(s)`));
    }
    if (resolved.length === 0 && newIssues.length === 0) {
      console.log(chalk.gray('  No changes'));
    }
    console.log('');
  }

  console.log(formatDiagnostics(allDiags));
  console.log('');

  previousDiags = currentDiags;
}

export const devCommand = new Command('dev')
  .description('Watch mode — re-run lint on file changes')
  .option('--context-dir <path>', 'Path to context directory')
  .option('--fix', 'Auto-fix problems on each re-lint')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);
      const fix = opts.fix === true;

      console.log(chalk.cyan(`${brand.banner}\n`));
      console.log(chalk.blue(`Watching ${contextDir} for changes...`));
      if (fix) console.log(chalk.blue('Auto-fix enabled.'));
      console.log(chalk.gray('Press Ctrl+C to stop.\n'));

      // Initial lint run
      await runLint(contextDir, fix);

      // Dynamic import of chokidar for watch mode
      const { watch } = await import('chokidar');

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      const watcher = watch(contextDir, {
        ignored: /(^|[/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
      });

      watcher.on('all', (_event, _filePath) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          try {
            await runLint(contextDir, fix);
          } catch (err) {
            console.error(
              chalk.red(`Lint error: ${(err as Error).message}`),
            );
          }
        }, 300);
      });
    } catch (err) {
      console.error(chalk.red(`Dev mode failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });
