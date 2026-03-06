import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceGrainNoPlaceholder: LintRule = {
  id: 'governance/grain-no-placeholder',
  defaultSeverity: 'warning',
  description: 'Grain statements must not contain scaffold placeholder text like "no primary key detected"',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      const gov = graph.governance.get(modelName);
      if (!gov?.datasets) continue;

      for (const ds of model.datasets) {
        const dsGov = gov.datasets[ds.name];
        if (dsGov?.grain && dsGov.grain.toLowerCase().includes('no primary key detected')) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Dataset "${ds.name}" in model "${modelName}" has a placeholder grain statement ("no primary key detected")`,
            location: { file: `governance:${modelName}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
