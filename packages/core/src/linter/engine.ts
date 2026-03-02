import type { ContextGraph, Diagnostic, Severity } from '../types/index.js';
import type { LintRule } from './rule.js';

export class LintEngine {
  private rules: LintRule[] = [];
  private overrides: Record<string, Severity | 'off'> = {};

  constructor(overrides?: Record<string, Severity | 'off'>) {
    if (overrides) this.overrides = overrides;
  }

  register(rule: LintRule): void {
    this.rules.push(rule);
  }

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const rule of this.rules) {
      const override = this.overrides[rule.id];
      if (override === 'off') continue;
      const results = rule.run(graph);
      for (const d of results) {
        diagnostics.push({
          ...d,
          severity: override ?? rule.defaultSeverity,
        });
      }
    }
    return diagnostics.sort(
      (a, b) =>
        a.location.file.localeCompare(b.location.file) ||
        a.location.line - b.location.line,
    );
  }
}
