import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';
import { resolveReferences } from '../../compiler/resolve.js';

export const referencesResolvable: LintRule = {
  id: 'references/resolvable',
  defaultSeverity: 'error',
  description: 'All cross-file references must resolve to existing entities',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    return resolveReferences(graph);
  },
};
