import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const osiRelationshipsCoverage: LintRule = {
  id: 'osi/relationships-coverage',
  defaultSeverity: 'warning',
  description: 'Models with 3+ datasets must define at least 3 relationships',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      const dsCount = model.datasets.length;
      if (dsCount < 3) continue;

      const relCount = model.relationships?.length ?? 0;
      if (relCount < 3) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Model "${modelName}" has ${dsCount} datasets but only ${relCount} relationships; models with 3+ datasets need at least 3`,
          location: { file: `model:${modelName}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
