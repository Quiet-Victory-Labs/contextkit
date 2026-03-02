import chalk from 'chalk';
import type { Diagnostic } from '@contextkit/core';

/**
 * Format diagnostics as human-readable colored terminal output.
 *
 * Each diagnostic is rendered as:
 *   file:line:col  severity  ruleId  message
 *
 * A summary line is appended at the end.
 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return chalk.green('No issues found.');
  }

  const lines: string[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const d of diagnostics) {
    const location = `${d.source.file}:${d.source.line}:${d.source.col}`;
    const severityLabel =
      d.severity === 'error'
        ? chalk.red('error')
        : chalk.yellow('warning');

    if (d.severity === 'error') {
      errorCount++;
    } else {
      warningCount++;
    }

    lines.push(`  ${location}  ${severityLabel}  ${chalk.dim(d.ruleId)}  ${d.message}`);
  }

  lines.push('');

  const parts: string[] = [];
  if (errorCount > 0) {
    parts.push(chalk.red(`${errorCount} error${errorCount !== 1 ? 's' : ''}`));
  }
  if (warningCount > 0) {
    parts.push(chalk.yellow(`${warningCount} warning${warningCount !== 1 ? 's' : ''}`));
  }
  lines.push(parts.join(', '));

  return lines.join('\n');
}
