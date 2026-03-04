import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const dataGuardrailsValidSql: LintRule = {
  id: 'data/guardrails-valid-sql',
  defaultSeverity: 'error',
  description: 'Guardrail filter expressions must be valid SQL when checked against the database',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    if (!graph.dataValidation) return [];
    const diagnostics: Diagnostic[] = [];

    for (const [rulesKey, rulesFile] of graph.rules) {
      const filters = rulesFile.guardrail_filters ?? [];

      for (let i = 0; i < filters.length; i++) {
        const result = graph.dataValidation.guardrailResults.get(i);
        if (!result) continue;

        if (!result.valid) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Guardrail filter "${filters[i]!.name}" has invalid SQL: ${result.error ?? 'unknown error'}`,
            location: { file: `rules:${rulesKey}`, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
