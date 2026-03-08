import type { ContextGraph } from '../types/graph.js';
import type { ContextKitConfig } from '../types/config.js';
import type { TierScore } from '../types/tier.js';
import type { OsiSemanticModel } from '../types/osi.js';
import type { GovernanceFile } from '../types/governance.js';
import type { RulesFile } from '../types/rules.js';
import type { LineageFile } from '../types/lineage.js';
import type { TermFile } from '../types/term.js';
import type { OwnerFile } from '../types/owner.js';

export interface Manifest {
  version: string;
  generatedAt: string;
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
export function emitManifest(graph: ContextGraph, _config: ContextKitConfig): Manifest {
  return {
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
}
