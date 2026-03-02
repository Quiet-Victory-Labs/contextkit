import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const glossaryNoDuplicateTerms: LintRule = {
  id: 'glossary/no-duplicate-synonyms',
  defaultSeverity: 'warning',
  description: 'No two terms should share the same synonym string',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const seen = new Map<string, string>(); // synonym -> first term id

    for (const [key, term] of graph.terms) {
      if (!term.synonyms) continue;
      for (const synonym of term.synonyms) {
        const lower = synonym.toLowerCase();
        const existing = seen.get(lower);
        if (existing && existing !== term.id) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Synonym "${synonym}" is used by both term "${existing}" and term "${term.id}"`,
            location: { file: `term:${key}`, line: 1, column: 1 },
            fixable: false,
          });
        } else {
          seen.set(lower, term.id);
        }
      }
    }

    return diagnostics;
  },
};
