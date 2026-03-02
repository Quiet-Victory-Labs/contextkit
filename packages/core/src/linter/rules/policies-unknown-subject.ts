import type { ContextGraph, Diagnostic, Policy } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Policy selectors must reference known concepts and tags.
 *
 * For each policy rule's `when` block:
 *  - `conceptIds` entries must exist as concept nodes in the graph
 *  - `tagsAny` entries must be used by at least one node (present in byTag index)
 */
export const policiesUnknownSubject: LintRule = {
  id: 'policies/unknown-subject',
  defaultSeverity: 'warning',
  fixable: false,
  description: 'Policy selectors must reference known concepts and tags',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const policyIds = graph.indexes.byKind.get('policy') ?? [];

    for (const policyId of policyIds) {
      const node = graph.nodes.get(policyId);
      if (!node || node.kind !== 'policy') continue;
      const policy = node as Policy;

      for (const rule of policy.rules) {
        // Check conceptIds
        if (rule.when.conceptIds) {
          for (const conceptId of rule.when.conceptIds) {
            const target = graph.nodes.get(conceptId);
            if (!target || target.kind !== 'concept') {
              diagnostics.push({
                ruleId: 'policies/unknown-subject',
                severity: 'warning',
                message: `policy "${policy.id}" references unknown concept "${conceptId}"`,
                source: policy.source,
                fixable: false,
              });
            }
          }
        }

        // Check tagsAny
        if (rule.when.tagsAny) {
          for (const tag of rule.when.tagsAny) {
            if (!graph.indexes.byTag.has(tag)) {
              diagnostics.push({
                ruleId: 'policies/unknown-subject',
                severity: 'warning',
                message: `policy "${policy.id}" references unknown tag "${tag}"`,
                source: policy.source,
                fixable: false,
              });
            }
          }
        }
      }
    }

    return diagnostics;
  },
};
