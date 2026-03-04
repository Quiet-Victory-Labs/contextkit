import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataGoldenQueriesExecute: LintRule = {
  id: 'data/golden-queries-execute',
  defaultSeverity: 'error',
  description: 'Golden queries must execute without errors against the database',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];

    for (const [rulesKey, rulesFile] of graph.rules) {
      const queries = rulesFile.golden_queries ?? [];

      for (let i = 0; i < queries.length; i++) {
        const result = graph.dataValidation.goldenQueryResults.get(i);
        if (!result) continue;

        if (!result.success) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Golden query #${i + 1} ("${queries[i]!.question}") failed: ${result.error ?? 'unknown error'}`,
            location: { file: `rules:${rulesKey}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
