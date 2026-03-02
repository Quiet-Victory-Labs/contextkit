import type { Severity, ContextGraph, Diagnostic } from '../types/index.js';
import type { LintRule } from './rule.js';

/**
 * ESLint-inspired lint engine that runs registered rules against a ContextGraph.
 *
 * Supports severity overrides from config:
 * - `'off'` disables a rule entirely
 * - `'error'` / `'warning'` overrides the rule's default severity
 */
export class LintEngine {
  private rules: LintRule[] = [];
  private overrides: Record<string, Severity | 'off'>;

  constructor(overrides?: Record<string, Severity | 'off'>) {
    this.overrides = overrides ?? {};
  }

  /** Register a lint rule with the engine. */
  register(rule: LintRule): void {
    this.rules.push(rule);
  }

  /**
   * Run all enabled rules against the graph and return sorted diagnostics.
   *
   * Diagnostics are sorted by source file (ascending) then line (ascending).
   */
  run(graph: ContextGraph): Diagnostic[] {
    const allDiagnostics: Diagnostic[] = [];

    for (const rule of this.rules) {
      const override = this.overrides[rule.id];

      // Skip disabled rules
      if (override === 'off') {
        continue;
      }

      const diagnostics = rule.run(graph);

      // Apply severity override if present
      const severity = (override as Severity | undefined) ?? rule.defaultSeverity;
      for (const diag of diagnostics) {
        allDiagnostics.push({ ...diag, severity });
      }
    }

    // Sort by file ascending, then line ascending
    allDiagnostics.sort((a, b) => {
      const fileCmp = a.source.file.localeCompare(b.source.file);
      if (fileCmp !== 0) return fileCmp;
      return a.source.line - b.source.line;
    });

    return allDiagnostics;
  }
}
