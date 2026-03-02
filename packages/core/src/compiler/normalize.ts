import type { ContextNode } from '../types/index.js';

/**
 * Convert a string to kebab-case.
 * Handles camelCase, PascalCase, snake_case, spaces, and mixed inputs.
 */
function toKebabCase(input: string): string {
  return input
    // Insert hyphen before uppercase letters that follow lowercase letters
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    // Replace underscores and spaces with hyphens
    .replace(/[_\s]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    .toLowerCase();
}

/**
 * Normalize a ContextNode:
 *  - Convert ID to kebab-case
 *  - Lowercase all tags
 */
export function normalizeNode(node: ContextNode): ContextNode {
  const normalized = { ...node, id: toKebabCase(node.id) };

  if (normalized.tags) {
    normalized.tags = normalized.tags.map((t) => t.toLowerCase());
  }

  return normalized as ContextNode;
}
