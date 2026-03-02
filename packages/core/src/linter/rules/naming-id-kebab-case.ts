import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const namingIdKebabCase: LintRule = {
  id: 'naming/id-kebab-case',
  defaultSeverity: 'warning',
  description: 'Owner and term IDs must be kebab-case',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, owner] of graph.owners) {
      if (!KEBAB_RE.test(owner.id)) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Owner ID "${owner.id}" is not kebab-case`,
          location: { file: `owner:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    for (const [key, term] of graph.terms) {
      if (!KEBAB_RE.test(term.id)) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Term ID "${term.id}" is not kebab-case`,
          location: { file: `term:${key}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
