import type { ContextGraph, Diagnostic, Term } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Detect terms with identical definitions.
 *
 * Since the graph uses a Map keyed by ID, true duplicate IDs cannot exist.
 * Instead, this rule flags term nodes whose `definition` text matches
 * another term's definition (case-insensitive, trimmed). The second
 * occurrence is flagged.
 */
export const glossaryNoDuplicateTerms: LintRule = {
  id: 'glossary/no-duplicate-terms',
  defaultSeverity: 'warning',
  fixable: false,
  description: 'Term definitions must be unique across the glossary',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Collect all term nodes
    const termIds = graph.indexes.byKind.get('term') ?? [];
    const seen = new Map<string, string>(); // normalized definition -> first term ID

    for (const termId of termIds) {
      const node = graph.nodes.get(termId);
      if (!node || node.kind !== 'term') continue;
      const term = node as Term;

      const normalized = term.definition.trim().toLowerCase();
      const firstId = seen.get(normalized);

      if (firstId !== undefined) {
        diagnostics.push({
          ruleId: 'glossary/no-duplicate-terms',
          severity: 'warning',
          message: `term "${term.id}" has the same definition as term "${firstId}"`,
          source: term.source,
          fixable: false,
        });
      } else {
        seen.set(normalized, term.id);
      }
    }

    return diagnostics;
  },
};
