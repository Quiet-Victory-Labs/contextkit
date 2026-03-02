import { Command } from 'commander';
import path from 'node:path';
import chalk from 'chalk';
import { watch } from 'chokidar';
import {
  loadConfig,
  compile,
  LintEngine,
  ALL_RULES,
} from '@runcontext/core';
import type { Diagnostic, Severity } from '@runcontext/core';

export const devCommand = new Command('dev')
  .description('Watch context files and rebuild on change')
  .action(async () => {
    try {
      const config = await loadConfig(process.cwd());

      const rootDir = config.paths?.rootDir || process.cwd();
      const contextDir = path.resolve(rootDir, config.paths?.contextDir || 'context');

      const watchPattern = path.join(contextDir, '**/*.{yaml,yml}');

      console.log(chalk.cyan(`Watching ${watchPattern} for changes...\n`));

      // Run an initial compile + lint
      await runBuild(contextDir, config);

      // Set up debounced watcher
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      const watcher = watch(watchPattern, {
        ignoreInitial: true,
        persistent: true,
      });

      watcher.on('all', (_event: string, _filePath: string) => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(async () => {
          debounceTimer = null;
          await runBuild(contextDir, config);
        }, 100);
      });

      watcher.on('error', (error: Error) => {
        console.error(chalk.red(`Watcher error: ${error.message}`));
      });

      // Handle clean exit
      const cleanup = () => {
        console.log(chalk.dim('\nStopping watch mode...'));
        watcher.close().then(() => {
          process.exit(0);
        });
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    } catch (err) {
      console.error('Dev mode failed:', (err as Error).message);
      process.exit(1);
    }
  });

async function runBuild(
  contextDir: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<void> {
  const separator = chalk.dim('─'.repeat(60));
  const timestamp = new Date().toLocaleTimeString();

  console.log(separator);
  console.log(chalk.bold(`[${timestamp}] Rebuilding...\n`));

  try {
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

    if (allDiags.length === 0) {
      console.log(chalk.green('No issues found.\n'));
      return;
    }

    // Print diagnostics summary
    let errorCount = 0;
    let warningCount = 0;
    let fixableCount = 0;

    for (const d of allDiags) {
      if (d.severity === 'error') errorCount++;
      else warningCount++;
      if (d.fixable) fixableCount++;

      const location = `${d.source.file}:${d.source.line}:${d.source.col}`;
      const severityLabel =
        d.severity === 'error'
          ? chalk.red('error')
          : chalk.yellow('warning');
      console.log(`  ${location}  ${severityLabel}  ${chalk.dim(d.ruleId)}  ${d.message}`);
    }

    console.log('');
    const parts: string[] = [];
    if (errorCount > 0) {
      parts.push(chalk.red(`${errorCount} error${errorCount !== 1 ? 's' : ''}`));
    }
    if (warningCount > 0) {
      parts.push(chalk.yellow(`${warningCount} warning${warningCount !== 1 ? 's' : ''}`));
    }
    if (fixableCount > 0) {
      parts.push(chalk.cyan(`${fixableCount} fixable`));
    }
    console.log(parts.join(', ') + '\n');
  } catch (err) {
    console.error(chalk.red(`Build error: ${(err as Error).message}\n`));
  }
}
