import type { OsiSemanticModel } from './osi.js';
import type { GovernanceFile } from './governance.js';
import type { RulesFile } from './rules.js';
import type { LineageFile } from './lineage.js';
import type { TermFile } from './term.js';
import type { OwnerFile } from './owner.js';
import type { TierScore } from './tier.js';

export interface ContextGraph {
  models: Map<string, OsiSemanticModel>;
  governance: Map<string, GovernanceFile>;
  rules: Map<string, RulesFile>;
  lineage: Map<string, LineageFile>;
  terms: Map<string, TermFile>;
  owners: Map<string, OwnerFile>;
  tiers: Map<string, TierScore>;
  indexes: {
    byOwner: Map<string, string[]>;
    byTag: Map<string, string[]>;
    byTrust: Map<string, string[]>;
    modelToGovernance: Map<string, string>;
    modelToRules: Map<string, string>;
    modelToLineage: Map<string, string>;
  };
}
