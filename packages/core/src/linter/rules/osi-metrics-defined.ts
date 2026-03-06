import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const osiMetricsDefined: LintRule = {
  id: 'osi/metrics-defined',
  defaultSeverity: 'warning',
  description: 'Models must define at least 1 computed metric in the metrics[] array',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      // Only check governed models — ungoverned models have no tier expectations
      const gov = graph.governance.get(modelName);
      if (!gov) continue;

      const count = model.metrics?.length ?? 0;
      if (count < 1) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Model "${modelName}" has no computed metrics; add reusable measures in metrics[]`,
          location: { file: `model:${modelName}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
