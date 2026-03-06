import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceModelExists: LintRule = {
  id: 'governance/model-exists',
  defaultSeverity: 'error',
  description: 'Every governance file must reference a model that exists in the graph',
  fixable: false,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!graph.models.has(gov.model)) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Governance references model "${gov.model}" which does not exist`,
          location: { file: `governance:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
