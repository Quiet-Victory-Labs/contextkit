import type { ContextGraph, Diagnostic, Concept } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Certified concepts must have at least one evidence entry.
 *
 * Checks every concept where `certified: true` and verifies the
 * `evidence` array is present and non-empty.
 */
export const conceptsCertifiedRequiresEvidence: LintRule = {
  id: 'concepts/certified-requires-evidence',
  defaultSeverity: 'error',
  fixable: false,
  description: 'Certified concepts must include at least one evidence entry',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const conceptIds = graph.indexes.byKind.get('concept') ?? [];

    for (const id of conceptIds) {
      const node = graph.nodes.get(id);
      if (!node || node.kind !== 'concept') continue;
      const concept = node as Concept;

      if (concept.certified && (!concept.evidence || concept.evidence.length === 0)) {
        diagnostics.push({
          ruleId: 'concepts/certified-requires-evidence',
          severity: 'error',
          message: `concept "${concept.id}" is certified but has no evidence`,
          source: concept.source,
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
