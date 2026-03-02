import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

const SECRET_PATTERNS = [
  /password\s*[=:]\s*\S+/i,
  /api[_-]?key\s*[=:]\s*\S+/i,
  /secret\s*[=:]\s*\S+/i,
  /token\s*[=:]\s*\S+/i,
  /\bsk-[a-zA-Z0-9]{10,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/, // AWS access key
];

function checkString(
  value: string | undefined,
  context: string,
  file: string,
  diagnostics: Diagnostic[],
  ruleId: string,
  severity: 'error' | 'warning',
): void {
  if (!value) return;
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(value)) {
      diagnostics.push({
        ruleId,
        severity,
        message: `Potential secret detected in ${context}: matches pattern ${pattern.source}`,
        location: { file, line: 1, column: 1 },
        fixable: false,
      });
      return; // one hit per string is enough
    }
  }
}

function aiContextToString(
  ctx: string | { instructions?: string; synonyms?: string[]; examples?: string[] } | undefined,
): string | undefined {
  if (!ctx) return undefined;
  if (typeof ctx === 'string') return ctx;
  const parts: string[] = [];
  if (ctx.instructions) parts.push(ctx.instructions);
  if (ctx.synonyms) parts.push(ctx.synonyms.join(' '));
  if (ctx.examples) parts.push(ctx.examples.join(' '));
  return parts.join(' ') || undefined;
}

export const noSecrets: LintRule = {
  id: 'security/no-secrets',
  defaultSeverity: 'error',
  description: 'Scan string values for patterns that look like secrets',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, model] of graph.models) {
      const file = `model:${key}`;
      checkString(model.description, `model "${model.name}" description`, file, diagnostics, this.id, this.defaultSeverity);
      checkString(aiContextToString(model.ai_context), `model "${model.name}" ai_context`, file, diagnostics, this.id, this.defaultSeverity);

      for (const ds of model.datasets) {
        checkString(ds.description, `dataset "${ds.name}" description`, file, diagnostics, this.id, this.defaultSeverity);
        checkString(aiContextToString(ds.ai_context), `dataset "${ds.name}" ai_context`, file, diagnostics, this.id, this.defaultSeverity);
        if (ds.fields) {
          for (const f of ds.fields) {
            checkString(f.description, `field "${f.name}" description`, file, diagnostics, this.id, this.defaultSeverity);
            checkString(aiContextToString(f.ai_context), `field "${f.name}" ai_context`, file, diagnostics, this.id, this.defaultSeverity);
          }
        }
      }
    }

    // Check governance string fields
    for (const [key, gov] of graph.governance) {
      const file = `governance:${key}`;
      if (gov.datasets) {
        for (const [dsName, ds] of Object.entries(gov.datasets)) {
          checkString(ds.grain, `dataset "${dsName}" grain`, file, diagnostics, this.id, this.defaultSeverity);
        }
      }
    }

    // Check rules string fields
    for (const [key, rules] of graph.rules) {
      const file = `rules:${key}`;
      if (rules.business_rules) {
        for (const br of rules.business_rules) {
          checkString(br.definition, `business rule "${br.name}" definition`, file, diagnostics, this.id, this.defaultSeverity);
        }
      }
    }

    return diagnostics;
  },
};
