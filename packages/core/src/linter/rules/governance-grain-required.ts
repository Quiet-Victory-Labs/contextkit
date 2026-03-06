import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';
import { insertNestedKey, readFileContent } from '../../fixer/yaml-locate.js';

export const governanceGrainRequired: LintRule = {
  id: 'governance/grain-required',
  defaultSeverity: 'warning',
  description: 'Every dataset in governance must have a grain statement',
  fixable: true,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.datasets) continue;

      for (const [dsName, ds] of Object.entries(gov.datasets)) {
        if (!ds.grain) {
          const syntheticFile = `governance:${key}`;
          const source = graph.sourceMap.get(syntheticFile);

          if (source) {
            const content = readFileContent(source.filePath);
            const edit = insertNestedKey(content, 'datasets', 'grain', '"TODO: describe the grain"', 4);
            diagnostics.push({
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Dataset "${dsName}" in governance for model "${gov.model}" is missing a grain statement`,
              location: { file: source.filePath, line: 1, column: 1 },
              fixable: true,
              fix: {
                description: `Add grain to dataset "${dsName}"`,
                edits: [edit],
              },
            });
          } else {
            diagnostics.push({
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Dataset "${dsName}" in governance for model "${gov.model}" is missing a grain statement`,
              location: { file: syntheticFile, line: 1, column: 1 },
              fixable: false,
            });
          }
        }
      }
    }

    return diagnostics;
  },
};
