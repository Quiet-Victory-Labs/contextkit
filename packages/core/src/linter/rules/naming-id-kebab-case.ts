import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Convert an arbitrary string to kebab-case.
 *
 * Handles camelCase, PascalCase, snake_case, and mixed formats.
 */
function toKebabCase(input: string): string {
  return input
    // Insert hyphen before uppercase letters that follow lowercase/digits
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    // Insert hyphen before uppercase runs followed by lowercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    // Replace underscores and spaces with hyphens
    .replace(/[_\s]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Lowercase
    .toLowerCase()
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * IDs must be kebab-case.
 *
 * Checks every node's `id` against the pattern `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`.
 * Provides an auto-fix that converts the ID to kebab-case.
 */
export const namingIdKebabCase: LintRule = {
  id: 'naming/id-kebab-case',
  defaultSeverity: 'error',
  fixable: true,
  description: 'IDs must be kebab-case',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [, node] of graph.nodes) {
      if (!KEBAB_RE.test(node.id)) {
        const suggested = toKebabCase(node.id);
        diagnostics.push({
          ruleId: 'naming/id-kebab-case',
          severity: 'error',
          message: `ID "${node.id}" is not kebab-case`,
          source: node.source,
          fixable: true,
          fix: {
            description: `Rename to "${suggested}"`,
            edits: [
              {
                file: node.source.file,
                range: {
                  startLine: node.source.line,
                  startCol: node.source.col,
                  endLine: node.source.line,
                  endCol: node.source.col,
                },
                newText: suggested,
              },
            ],
          },
        });
      }
    }

    return diagnostics;
  },
};
