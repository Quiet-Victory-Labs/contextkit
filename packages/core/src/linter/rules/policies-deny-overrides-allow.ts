import type { ContextGraph, Diagnostic, Policy } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Deny rules should have higher priority than allow rules.
 *
 * Within each policy, if any rule has `then.deny: true`, its priority
 * should be numerically greater than every non-deny rule in the same
 * policy. Emits a diagnostic if a deny rule has lower priority than
 * a non-deny rule.
 */
export const policiesDenyOverridesAllow: LintRule = {
  id: 'policies/deny-overrides-allow',
  defaultSeverity: 'warning',
  fixable: false,
  description: 'Deny rules should have higher priority than allow rules',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const policyIds = graph.indexes.byKind.get('policy') ?? [];

    for (const policyId of policyIds) {
      const node = graph.nodes.get(policyId);
      if (!node || node.kind !== 'policy') continue;
      const policy = node as Policy;

      // Find the max priority among non-deny rules
      let maxAllowPriority = -Infinity;
      for (const rule of policy.rules) {
        if (!rule.then.deny) {
          maxAllowPriority = Math.max(maxAllowPriority, rule.priority);
        }
      }

      // Check that every deny rule has higher priority than all allow rules
      for (const rule of policy.rules) {
        if (rule.then.deny && maxAllowPriority > -Infinity && rule.priority <= maxAllowPriority) {
          diagnostics.push({
            ruleId: 'policies/deny-overrides-allow',
            severity: 'warning',
            message: `policy "${policy.id}" has a deny rule with priority ${rule.priority} that does not override allow rules (max allow priority: ${maxAllowPriority})`,
            source: policy.source,
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
