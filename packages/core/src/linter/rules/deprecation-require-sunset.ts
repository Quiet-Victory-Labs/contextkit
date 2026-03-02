import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Deprecated nodes must include a sunset date tag.
 *
 * Checks every node with `status: 'deprecated'` for a tag matching
 * the `sunset:*` pattern (e.g., `sunset:2026-06-01`).
 */
export const deprecationRequireSunset: LintRule = {
  id: 'deprecation/require-sunset',
  defaultSeverity: 'warning',
  fixable: false,
  description: 'Deprecated nodes must include a sunset date tag',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const deprecatedIds = graph.indexes.byStatus.get('deprecated') ?? [];

    for (const id of deprecatedIds) {
      const node = graph.nodes.get(id);
      if (!node) continue;

      const hasSunset = node.tags?.some(tag => tag.startsWith('sunset:')) ?? false;

      if (!hasSunset) {
        diagnostics.push({
          ruleId: 'deprecation/require-sunset',
          severity: 'warning',
          message: `${node.kind} "${node.id}" is deprecated but has no sunset:* tag`,
          source: node.source,
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
