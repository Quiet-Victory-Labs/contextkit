import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';
import { insertNestedKey, readFileContent } from '../../fixer/yaml-locate.js';

export const governanceRefreshRequired: LintRule = {
  id: 'governance/refresh-required',
  defaultSeverity: 'warning',
  description: 'All governed datasets must have a refresh cadence set',
  fixable: true,
  tier: 'silver',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.datasets) continue;

      for (const [dsName, ds] of Object.entries(gov.datasets)) {
        if (!ds.refresh) {
          const syntheticFile = `governance:${key}`;
          const source = graph.sourceMap.get(syntheticFile);

          if (source) {
            const content = readFileContent(source.filePath);
            const edit = insertNestedKey(content, 'datasets', 'refresh', '"TODO"', 2, dsName);
            diagnostics.push({
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Dataset "${dsName}" in governance for model "${gov.model}" is missing a refresh cadence`,
              location: { file: source.filePath, line: 1, column: 1 },
              fixable: true,
              fix: {
                description: `Add refresh to dataset "${dsName}"`,
                edits: [edit],
              },
            });
          } else {
            diagnostics.push({
              ruleId: this.id,
              severity: this.defaultSeverity,
              message: `Dataset "${dsName}" in governance for model "${gov.model}" is missing a refresh cadence`,
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
