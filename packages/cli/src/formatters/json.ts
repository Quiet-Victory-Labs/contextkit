import type { Diagnostic } from '@runcontext/core';

/**
 * Format diagnostics as a JSON string with 2-space indentation.
 */
export function formatDiagnosticsJson(diagnostics: Diagnostic[]): string {
  return JSON.stringify(diagnostics, null, 2);
}
