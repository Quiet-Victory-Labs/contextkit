import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const glossaryDefinitionQuality: LintRule = {
  id: 'glossary/definition-quality',
  defaultSeverity: 'warning',
  description: 'Glossary definitions must be substantive, not placeholder text like "Definition for X"',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [termId, term] of graph.terms) {
      if (term.definition.length < 20 || /^definition (for|of) /i.test(term.definition)) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Glossary term "${termId}" has a placeholder definition`,
          location: { file: `term:${termId}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
