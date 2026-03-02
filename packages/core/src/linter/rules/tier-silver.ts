import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';

/**
 * Composite Silver tier check (beyond Bronze).
 *
 * Silver requirements per governed model:
 * - Trust status set
 * - Tags (>=2)
 * - Glossary linked (at least 1 term referencing the owner)
 * - Upstream lineage exists
 * - Refresh cadence on all datasets
 * - Sample values on >=2 fields
 */
export const tierSilver: LintRule = {
  id: 'tier/silver-requirements',
  defaultSeverity: 'warning',
  description: 'Checks all Silver tier requirements (beyond Bronze) as a composite',
  fixable: false,
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [modelName, gov] of graph.governance) {
      const missing: string[] = [];

      // Trust status
      if (!gov.trust) {
        missing.push('trust status');
      }

      // Tags (>=2)
      if (!gov.tags || gov.tags.length < 2) {
        missing.push(`tags (need >=2, have ${gov.tags?.length ?? 0})`);
      }

      // Glossary linked: at least 1 term exists that references the same owner
      const hasGlossaryLink = Array.from(graph.terms.values()).some(
        (term) => term.owner === gov.owner,
      );
      if (!hasGlossaryLink) {
        missing.push('glossary linked');
      }

      // Upstream lineage
      const lineage = graph.lineage.get(modelName);
      if (!lineage || !lineage.upstream || lineage.upstream.length === 0) {
        missing.push('upstream lineage');
      }

      // Refresh cadence on all datasets
      if (gov.datasets) {
        for (const [dsName, ds] of Object.entries(gov.datasets)) {
          if (!ds.refresh) {
            missing.push(`refresh cadence on dataset "${dsName}"`);
          }
        }
      }

      // Sample values on >=2 fields
      let sampleValuesCount = 0;
      if (gov.fields) {
        for (const field of Object.values(gov.fields)) {
          if (field.sample_values && field.sample_values.length > 0) {
            sampleValuesCount++;
          }
        }
      }
      if (sampleValuesCount < 2) {
        missing.push(`sample values on >=2 fields (have ${sampleValuesCount})`);
      }

      if (missing.length > 0) {
        diagnostics.push({
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Model "${modelName}" is missing Silver requirements: ${missing.join(', ')}`,
          location: { file: `governance:${modelName}`, line: 1, column: 1 },
          fixable: false,
        });
      }
    }

    return diagnostics;
  },
};
