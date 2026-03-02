import type { ContextGraph, Diagnostic, Concept, Term } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Verify that all cross-node references resolve to existing nodes.
 *
 * Checks:
 *  - Concept: `dependsOn`, `productId`, `owner`
 *  - Term: `mapsTo`
 *  - Product / Entity: `owner`
 *  - Policy / Owner: no reference checks
 */
export const referencesResolvable: LintRule = {
  id: 'references/resolvable',
  defaultSeverity: 'error',
  fixable: false,
  description: 'All cross-node references must resolve to existing nodes',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [, node] of graph.nodes) {
      // Skip kinds that don't have outbound references to check
      if (node.kind === 'policy' || node.kind === 'owner') continue;

      // Check owner reference (concepts, products, entities, terms)
      if (node.owner && !graph.nodes.has(node.owner)) {
        diagnostics.push({
          ruleId: 'references/resolvable',
          severity: 'error',
          message: `${node.kind} "${node.id}" references owner "${node.owner}" which does not exist`,
          source: node.source,
          fixable: false,
        });
      }

      if (node.kind === 'concept') {
        const concept = node as Concept;

        // Check dependsOn
        if (concept.dependsOn) {
          for (const dep of concept.dependsOn) {
            if (!graph.nodes.has(dep)) {
              diagnostics.push({
                ruleId: 'references/resolvable',
                severity: 'error',
                message: `concept "${concept.id}" depends on "${dep}" which does not exist`,
                source: concept.source,
                fixable: false,
              });
            }
          }
        }

        // Check productId
        if (concept.productId && !graph.nodes.has(concept.productId)) {
          diagnostics.push({
            ruleId: 'references/resolvable',
            severity: 'error',
            message: `concept "${concept.id}" references product "${concept.productId}" which does not exist`,
            source: concept.source,
            fixable: false,
          });
        }
      }

      if (node.kind === 'term') {
        const term = node as Term;

        // Check mapsTo
        if (term.mapsTo) {
          for (const target of term.mapsTo) {
            if (!graph.nodes.has(target)) {
              diagnostics.push({
                ruleId: 'references/resolvable',
                severity: 'error',
                message: `term "${term.id}" maps to "${target}" which does not exist`,
                source: term.source,
                fixable: false,
              });
            }
          }
        }
      }
    }

    return diagnostics;
  },
};
