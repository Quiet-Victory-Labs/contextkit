import chalk from 'chalk';
import type { Diagnostic, TierScore, TierCheckResult } from '@runcontext/core';

/**
 * Format an array of diagnostics as colorized, human-readable text.
 */
export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return chalk.green('No issues found.');
  }

  const lines: string[] = [];

  for (const d of diagnostics) {
    const icon =
      d.severity === 'error' ? chalk.red('error') : chalk.yellow('warning');
    const loc = chalk.gray(
      `${d.location.file}:${d.location.line}:${d.location.column}`,
    );
    const rule = chalk.gray(`[${d.ruleId}]`);
    const fixTag = d.fixable ? chalk.blue(' (fixable)') : '';

    lines.push(`  ${icon} ${d.message} ${rule}${fixTag}`);
    lines.push(`    ${loc}`);
  }

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = diagnostics.filter((d) => d.severity === 'warning').length;

  lines.push('');
  const parts: string[] = [];
  if (errorCount > 0) parts.push(chalk.red(`${errorCount} error(s)`));
  if (warnCount > 0) parts.push(chalk.yellow(`${warnCount} warning(s)`));
  lines.push(parts.join(', '));

  return lines.join('\n');
}

/**
 * Format a tier score as colorized, human-readable text.
 */
export function formatTierScore(score: TierScore): string {
  const lines: string[] = [];

  const tierColor = getTierColor(score.tier);
  lines.push(
    `${chalk.bold(score.model)}: ${tierColor(score.tier.toUpperCase())}`,
  );
  lines.push('');

  lines.push(formatTierSection('Bronze', score.bronze.passed, score.bronze.checks));
  lines.push(formatTierSection('Silver', score.silver.passed, score.silver.checks));
  lines.push(formatTierSection('Gold', score.gold.passed, score.gold.checks));

  return lines.join('\n');
}

function formatTierSection(
  label: string,
  passed: boolean,
  checks: TierCheckResult[],
): string {
  const lines: string[] = [];
  const status = passed ? chalk.green('PASS') : chalk.red('FAIL');
  lines.push(`  ${label}: ${status}`);

  for (const check of checks) {
    const icon = check.passed ? chalk.green('  +') : chalk.red('  -');
    lines.push(`  ${icon} ${check.label}`);
    if (check.detail && !check.passed) {
      lines.push(chalk.gray(`      ${check.detail}`));
    }
  }

  return lines.join('\n');
}

function getTierColor(tier: string): (text: string) => string {
  switch (tier) {
    case 'gold':
      return chalk.yellow;
    case 'silver':
      return chalk.white;
    case 'bronze':
      return chalk.hex('#CD7F32');
    default:
      return chalk.gray;
  }
}

/**
 * Format a generic info message.
 */
export function formatInfo(message: string): string {
  return chalk.blue(message);
}

/**
 * Format an error message.
 */
export function formatError(message: string): string {
  return chalk.red(`Error: ${message}`);
}

/**
 * Format a success message.
 */
export function formatSuccess(message: string): string {
  return chalk.green(message);
}
