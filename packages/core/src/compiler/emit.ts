import type { ContextGraph } from '../types/graph.js';
import type { RunContextConfig } from '../types/config.js';
import type { TierScore } from '../types/tier.js';
import type { OsiSemanticModel } from '../types/osi.js';
import type { GovernanceFile } from '../types/governance.js';
import type { RulesFile } from '../types/rules.js';
import type { LineageFile } from '../types/lineage.js';
import type { TermFile } from '../types/term.js';
import type { OwnerFile } from '../types/owner.js';

export interface ManifestProductGroup {
  models: Record<string, OsiSemanticModel>;
  governance: Record<string, GovernanceFile>;
  rules: Record<string, RulesFile>;
  lineage: Record<string, LineageFile>;
}

export interface Manifest {
  version: string;
  generatedAt: string;
  /** Grouped by product (present when multi-product). */
  products?: Record<string, ManifestProductGroup>;
  /** Flat model map (always present for backward compat). */
  models: Record<string, OsiSemanticModel>;
  governance: Record<string, GovernanceFile>;
  rules: Record<string, RulesFile>;
  lineage: Record<string, LineageFile>;
  terms: Record<string, TermFile>;
  owners: Record<string, OwnerFile>;
  tiers: Record<string, TierScore>;
}

/** Convert a Map to a plain Record for JSON serialization. */
function mapToRecord<V>(map: Map<string, V>): Record<string, V> {
  const record: Record<string, V> = {};
  for (const [key, value] of map) {
    record[key] = value;
  }
  return record;
}

/**
 * Emit a compiled ContextGraph as a JSON-serializable Manifest object.
 *
 * Converts all internal Maps to plain Records suitable for `JSON.stringify`.
 */
export function emitManifest(graph: ContextGraph, _config: RunContextConfig): Manifest {
  const manifest: Manifest = {
    version: '0.5.0',
    generatedAt: new Date().toISOString(),
    models: mapToRecord(graph.models),
    governance: mapToRecord(graph.governance),
    rules: mapToRecord(graph.rules),
    lineage: mapToRecord(graph.lineage),
    terms: mapToRecord(graph.terms),
    owners: mapToRecord(graph.owners),
    tiers: mapToRecord(graph.tiers),
  };

  // Group by product if productMap has entries
  if (graph.productMap && graph.productMap.size > 0) {
    const products: Record<string, ManifestProductGroup> = {};
    const productNames = new Set(graph.productMap.values());

    for (const productName of productNames) {
      const productModels: Record<string, OsiSemanticModel> = {};
      const productGovernance: Record<string, GovernanceFile> = {};
      const productRules: Record<string, RulesFile> = {};
      const productLineage: Record<string, LineageFile> = {};

      for (const [name, product] of graph.productMap) {
        if (product !== productName) continue;

        const model = graph.models.get(name);
        if (model) productModels[name] = model;

        const gov = graph.governance.get(name);
        if (gov) productGovernance[name] = gov;

        const rules = graph.rules.get(name);
        if (rules) productRules[name] = rules;

        const lineage = graph.lineage.get(name);
        if (lineage) productLineage[name] = lineage;
      }

      products[productName] = {
        models: productModels,
        governance: productGovernance,
        rules: productRules,
        lineage: productLineage,
      };
    }

    manifest.products = products;
  }

  return manifest;
}
