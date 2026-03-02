import type { ContextGraph, Diagnostic, Concept } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Secret patterns to scan for in text content.
 *
 * Kept intentionally narrow to avoid false positives on normal prose.
 */
const SECRET_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
  { label: 'password assignment', re: /password\s*[:=]\s*\S+/i },
  { label: 'secret assignment', re: /secret\s*[:=]\s*\S+/i },
  { label: 'token assignment', re: /token\s*[:=]\s*\S+/i },
  { label: 'API key (long hex/alnum)', re: /(?:api[_-]?key|apikey)\s*[:=]\s*[A-Za-z0-9]{16,}/ },
];

/**
 * Test a string against all secret patterns.
 * Returns the label of the first match, or undefined.
 */
function detectSecret(text: string): string | undefined {
  for (const { label, re } of SECRET_PATTERNS) {
    if (re.test(text)) return label;
  }
  return undefined;
}

/**
 * Scan all string fields in every node for secret patterns.
 *
 * Checks `description`, `definition`, and example `content` fields.
 */
export const packagingNoSecrets: LintRule = {
  id: 'packaging/no-secrets',
  defaultSeverity: 'error',
  fixable: false,
  description: 'Node content must not contain secret patterns (API keys, passwords, tokens)',

  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [, node] of graph.nodes) {
      // Check description
      if (node.description) {
        const match = detectSecret(node.description);
        if (match) {
          diagnostics.push({
            ruleId: 'packaging/no-secrets',
            severity: 'error',
            message: `${node.kind} "${node.id}" description contains a potential ${match}`,
            source: node.source,
            fixable: false,
          });
        }
      }

      // Check definition (concepts, terms, entities)
      const asRecord = node as unknown as Record<string, unknown>;
      if (typeof asRecord.definition === 'string') {
        const match = detectSecret(asRecord.definition);
        if (match) {
          diagnostics.push({
            ruleId: 'packaging/no-secrets',
            severity: 'error',
            message: `${node.kind} "${node.id}" definition contains a potential ${match}`,
            source: node.source,
            fixable: false,
          });
        }
      }

      // Check examples (concepts)
      if (node.kind === 'concept') {
        const concept = node as Concept;
        if (concept.examples) {
          for (const example of concept.examples) {
            const match = detectSecret(example.content);
            if (match) {
              diagnostics.push({
                ruleId: 'packaging/no-secrets',
                severity: 'error',
                message: `concept "${concept.id}" example "${example.label}" contains a potential ${match}`,
                source: concept.source,
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
