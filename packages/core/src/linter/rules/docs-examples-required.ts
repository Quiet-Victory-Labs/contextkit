import type { ContextGraph, Diagnostic, Concept } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Certified concepts should include at least one example.
 *
 * Checks every concept with `certified: true` and verifies the
 * `examples` array is present and non-empty.
 */
export const docsExamplesRequired: LintRule = {
  id: 'docs/examples-required',
  defaultSeverity: 'warning',
  fixable: false,
  description: 'Certified concepts should include at least one example',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const conceptIds = graph.indexes.byKind.get('concept') ?? [];

    for (const id of conceptIds) {
      const node = graph.nodes.get(id);
      if (!node || node.kind !== 'concept') continue;
      const concept = node as Concept;

      if (concept.certified && (!concept.examples || concept.examples.length === 0)) {
        diagnostics.push({
          ruleId: 'docs/examples-required',
          severity: 'warning',
          message: `concept "${concept.id}" is certified but has no examples`,
          source: concept.source,
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
