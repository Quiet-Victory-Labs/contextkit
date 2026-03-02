import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const governanceDatasetsExist: LintRule = {
  id: 'governance/datasets-exist',
  defaultSeverity: 'error',
  description: 'Every dataset key in governance must exist as a dataset in the referenced OSI model',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.datasets) continue;

      const model = graph.models.get(gov.model);
      if (!model) continue; // governance-model-exists handles this

      const validDatasets = new Set(model.datasets.map((d) => d.name));

      for (const dsName of Object.keys(gov.datasets)) {
        if (!validDatasets.has(dsName)) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Governance dataset "${dsName}" does not exist in model "${gov.model}"`,
            location: { file: `governance:${key}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
