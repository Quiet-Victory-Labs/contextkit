import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Composite Gold tier check (beyond Silver).
 *
 * Gold requirements per governed model:
 * - Every field has semantic_role
 * - Metrics have aggregation
 * - Metrics have additive
 * - Guardrails exist
 * - >=3 golden queries
 * - Business rules exist
 * - Hierarchies exist
 * - Default filters exist (at least one field with default_filter)
 * - Trust is endorsed
 */
export const tierGold: LintRule = {
  id: 'tier/gold-requirements',
  defaultSeverity: 'warning',
  description: 'Checks all Gold tier requirements (beyond Silver) as a composite',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, gov] of graph.governance) {
      const missing: string[] = [];
      const model = graph.models.get(modelName);

      // Trust is endorsed
      if (gov.trust !== 'endorsed') {
        missing.push('trust must be endorsed');
      }

      // Every field has semantic_role
      if (model) {
        const govFields = gov.fields ?? {};
        for (const dataset of model.datasets) {
          if (!dataset.fields) continue;
          for (const field of dataset.fields) {
            const fieldKey = `${dataset.name}.${field.name}`;
            const govField = govFields[fieldKey];
            if (!govField || !govField.semantic_role) {
              missing.push(`semantic_role for "${fieldKey}"`);
            }
          }
        }
      }

      // Metrics have aggregation and additive
      if (gov.fields) {
        for (const [fieldName, field] of Object.entries(gov.fields)) {
          if (field.semantic_role === 'metric') {
            if (!field.default_aggregation) {
              missing.push(`aggregation for metric "${fieldName}"`);
            }
            if (field.additive == null) {
              missing.push(`additive for metric "${fieldName}"`);
            }
          }
        }
      }

      // Default filters exist (at least one field with default_filter)
      let hasDefaultFilter = false;
      if (gov.fields) {
        for (const field of Object.values(gov.fields)) {
          if (field.default_filter) {
            hasDefaultFilter = true;
            break;
          }
        }
      }
      if (!hasDefaultFilter) {
        missing.push('default filters');
      }

      // Rules file checks
      const rules = graph.rules.get(modelName);
      if (!rules) {
        missing.push('rules file (golden queries, business rules, guardrails, hierarchies)');
      } else {
        // >=3 golden queries
        const goldenCount = rules.golden_queries?.length ?? 0;
        if (goldenCount < 3) {
          missing.push(`>=3 golden queries (have ${goldenCount})`);
        }

        // Business rules exist
        const bizCount = rules.business_rules?.length ?? 0;
        if (bizCount < 1) {
          missing.push('business rules');
        }

        // Guardrails exist
        const guardCount = rules.guardrail_filters?.length ?? 0;
        if (guardCount < 1) {
          missing.push('guardrail filters');
        }

        // Hierarchies exist
        const hierCount = rules.hierarchies?.length ?? 0;
        if (hierCount < 1) {
          missing.push('hierarchies');
        }
      }

      if (missing.length > 0) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Model "${modelName}" is missing Gold requirements: ${missing.join(', ')}`,
          location: { file: `governance:${modelName}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
