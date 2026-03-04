import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataGoldenQueriesNonempty: LintRule = {
  id: 'data/golden-queries-nonempty',
  defaultSeverity: 'warning',
  description: 'Golden queries should return at least one row when executed',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];

    for (const [rulesKey, rulesFile] of graph.rules) {
      const queries = rulesFile.golden_queries ?? [];

      for (let i = 0; i < queries.length; i++) {
        const result = graph.dataValidation.goldenQueryResults.get(i);
        if (!result || !result.success) continue; // skip failed queries

        if (result.rowCount !== undefined && result.rowCount === 0) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Golden query #${i + 1} ("${queries[i]!.question}") returned 0 rows`,
            location: { file: `rules:${rulesKey}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
