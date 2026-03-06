import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const lineageNoSelfReference: LintRule = {
  id: 'lineage/no-self-reference',
  defaultSeverity: 'warning',
  description: 'Upstream lineage sources must reference real external systems, not dataset names from the same model',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      const lineageKey = graph.indexes.modelToLineage.get(modelName);
      const lineage = lineageKey ? graph.lineage.get(lineageKey) : undefined;
      if (!lineage?.upstream || lineage.upstream.length === 0) continue;

      const dsNames = new Set(model.datasets.map((ds) => ds.name));
      const selfRefs = lineage.upstream.filter((u) => dsNames.has(u.source));

      if (selfRefs.length > 0) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Model "${modelName}" has ${selfRefs.length} upstream source(s) that reference dataset names instead of real external sources: ${selfRefs.map((u) => u.source).join(', ')}`,
          location: { file: `lineage:${modelName}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
