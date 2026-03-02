import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Composite Bronze tier check.
 *
 * Bronze requirements per model:
 * - Model has description
 * - All datasets have descriptions
 * - All fields have descriptions
 * - Governance exists with owner
 * - Security classification set
 * - All datasets have grain
 * - All datasets have table_type
 */
export const tierBronze: LintRule = {
  id: 'tier/bronze-requirements',
  defaultSeverity: 'warning',
  description: 'Checks all Bronze tier requirements as a composite',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, model] of graph.models) {
      const missing: string[] = [];

      // Model description
      if (!model.description) {
        missing.push('model description');
      }

      // Dataset descriptions
      for (const dataset of model.datasets) {
        if (!dataset.description) {
          missing.push(`dataset "${dataset.name}" description`);
        }

        // Field descriptions
        if (dataset.fields) {
          for (const field of dataset.fields) {
            if (!field.description) {
              missing.push(`field "${dataset.name}.${field.name}" description`);
            }
          }
        }
      }

      // Governance existence with owner
      const gov = graph.governance.get(modelName);
      if (!gov) {
        missing.push('governance file');
      } else {
        if (!gov.owner) {
          missing.push('governance owner');
        }

        // Security classification
        if (!gov.security) {
          missing.push('security classification');
        }

        // Datasets in governance: grain and table_type
        if (gov.datasets) {
          for (const [dsName, ds] of Object.entries(gov.datasets)) {
            if (!ds.grain) {
              missing.push(`dataset "${dsName}" grain`);
            }
            if (!ds.table_type) {
              missing.push(`dataset "${dsName}" table_type`);
            }
          }
        } else {
          // If no datasets in governance at all, check if model has datasets
          if (model.datasets.length > 0) {
            missing.push('governance datasets');
          }
        }
      }

      if (missing.length > 0) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Model "${modelName}" is missing Bronze requirements: ${missing.join(', ')}`,
          location: { file: `model:${modelName}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
