import type { ContextGraph, Diagnostic, NodeKind } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/** Node kinds that require an owner. */
const REQUIRES_OWNER: ReadonlySet<NodeKind> = new Set(['concept', 'product', 'entity']);

/**
 * Concepts, products, and entities require an owner.
 *
 * Checks that nodes of the above kinds have a non-empty `owner` field.
 * Provides a stub fix that adds `owner: TODO`.
 */
export const ownershipRequired: LintRule = {
  id: 'ownership/required',
  defaultSeverity: 'error',
  fixable: true,
  description: 'Concepts, products, and entities require an owner',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [, node] of graph.nodes) {
      if (!REQUIRES_OWNER.has(node.kind)) continue;

      if (!node.owner) {
        diagnostics.push({
          ruleId: 'ownership/required',
          severity: 'error',
          message: `${node.kind} "${node.id}" is missing a required owner`,
          source: node.source,
          fixable: true,
          fix: {
            description: 'Add owner field',
            edits: [
              {
                file: node.source.file,
                range: {
                  startLine: node.source.line,
                  startCol: node.source.col,
                  endLine: node.source.line,
                  endCol: node.source.col,
                },
                newText: 'owner: TODO\n',
              },
            ],
          },
        });
      }
    }

    return diagnostics;
  },
};
