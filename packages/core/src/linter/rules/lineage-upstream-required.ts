import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const lineageUpstreamRequired: LintRule = {
  id: 'lineage/upstream-required',
  defaultSeverity: 'warning',
  description: 'Every governed model should have a lineage file with at least one upstream entry',
  fixable: false,
  tier: 'silver',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName] of graph.governance) {
      // Only check models that have governance
      const lineage = graph.lineage.get(modelName);
      if (!lineage || !lineage.upstream || lineage.upstream.length === 0) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Governed model "${modelName}" is missing lineage with at least one upstream entry`,
          location: { file: `governance:${modelName}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
