import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

export const glossaryCoverage: LintRule = {
  id: 'glossary/coverage',
  defaultSeverity: 'warning',
  description: 'Models with 5+ datasets must have at least 3 linked glossary terms',
  fixable: false,
  tier: 'gold',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      const dsCount = model.datasets.length;
      if (dsCount < 5) continue;

      const gov = graph.governance.get(modelName);
      if (!gov) continue;

      const govTags = new Set(gov.tags ?? []);
      const govOwner = gov.owner;
      let linkedCount = 0;

      for (const [, term] of graph.terms) {
        let linked = false;
        if (term.tags) {
          for (const tag of term.tags) {
            if (govTags.has(tag)) {
              linked = true;
              break;
            }
          }
        }
        if (term.owner && term.owner === govOwner) {
          linked = true;
        }
        if (linked) linkedCount++;
      }

      if (linkedCount < 3) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Model "${modelName}" has ${dsCount} datasets but only ${linkedCount} glossary terms; complex models need at least 3`,
          location: { file: `model:${modelName}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
