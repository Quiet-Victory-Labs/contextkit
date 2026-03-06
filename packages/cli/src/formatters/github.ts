import type { Diagnostic } from '@runcontext/core';

/**
 * Format diagnostics as GitHub Actions workflow commands.
 * Output: ::warning file={f},line={l},col={c},title={ruleId}::{message}
 * Works in any GitHub Actions workflow — annotations appear inline on PRs.
 */
export function formatGitHub(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (const d of diagnostics) {
    const level = d.severity === 'error' ? 'error' : 'warning';
    lines.push(
      `::${level} file=${d.location.file},line=${d.location.line},col=${d.location.column},title=${d.ruleId}::${d.message}`,
    );
  }

  return lines.join('\n');
}
