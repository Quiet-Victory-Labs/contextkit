import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Check whether a node has a description or definition.
 *
 * Nodes that carry `definition` (concepts, terms, possibly entities)
 * satisfy the requirement through that field. All other nodes must
 * have a non-empty `description`.
 */
function hasDescriptionOrDefinition(node: Record<string, unknown>): boolean {
  if (typeof node.description === 'string' && node.description.length > 0) {
    return true;
  }
  if (typeof node.definition === 'string' && node.definition.length > 0) {
    return true;
  }
  return false;
}

/**
 * All nodes should have a description or definition.
 *
 * Provides a stub fix that adds a description placeholder.
 */
export const descriptionsRequired: LintRule = {
  id: 'descriptions/required',
  defaultSeverity: 'warning',
  fixable: true,
  description: 'All nodes should have a description or definition',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [, node] of graph.nodes) {
      if (!hasDescriptionOrDefinition(node as unknown as Record<string, unknown>)) {
        diagnostics.push({
          ruleId: 'descriptions/required',
          severity: 'warning',
          message: `${node.kind} "${node.id}" is missing a description or definition`,
          source: node.source,
          fixable: true,
          fix: {
            description: 'Add description field',
            edits: [
              {
                file: node.source.file,
                range: {
                  startLine: node.source.line,
                  startCol: node.source.col,
                  endLine: node.source.line,
                  endCol: node.source.col,
                },
                newText: 'description: TODO\n',
              },
            ],
          },
        });
      }
    }

    return diagnostics;
  },
};
