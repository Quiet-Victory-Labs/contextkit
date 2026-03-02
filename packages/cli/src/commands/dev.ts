import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import {
  compile,
  loadConfig,
  LintEngine,
  ALL_RULES,
  type Severity,
} from '@runcontext/core';
import { formatDiagnostics } from '../formatters/pretty.js';

async function runLint(contextDir: string): Promise<void> {
  const config = loadConfig(process.cwd());

  const { graph, diagnostics: compileDiags } = await compile({
    contextDir,
    config,
  });

  const overrides = config.lint?.severity_overrides as
    | Record<string, Severity | 'off'>
    | undefined;
  const engine = new LintEngine(overrides);
  for (const rule of ALL_RULES) {
    engine.register(rule);
  }
  const lintDiags = engine.run(graph);
  const allDiags = [...compileDiags, ...lintDiags];

  console.clear();
  console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] Linting...`));
  console.log(formatDiagnostics(allDiags));
  console.log('');
}

export const devCommand = new Command('dev')
  .description('Watch mode — re-run lint on file changes')
  .option('--context-dir <path>', 'Path to context directory')
  .action(async (opts) => {
    try {
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);

      console.log(chalk.blue(`Watching ${contextDir} for changes...`));
      console.log(chalk.gray('Press Ctrl+C to stop.\n'));

      // Initial lint run
      await runLint(contextDir);

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
            await runLint(contextDir);
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
