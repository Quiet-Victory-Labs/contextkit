import type { OsiSemanticModel } from './osi.js';
import type { GovernanceFile } from './governance.js';
import type { RulesFile } from './rules.js';
import type { LineageFile } from './lineage.js';
import type { TermFile } from './term.js';
import type { OwnerFile } from './owner.js';
import type { TierScore } from './tier.js';

/** Pre-computed results from running data validation against a live database. */
export interface DataValidationInfo {
  /** Map of table name -> row count for tables that exist in the database. */
  existingTables: Map<string, number>;
  /** Map of table name -> (column name -> column type) for discovered columns. */
  existingColumns: Map<string, Map<string, string>>;
  /** Map of "dataset.field" -> actual sample values found in the database. */
  actualSampleValues: Map<string, string[]>;
  /** Map of golden query index -> execution result. */
  goldenQueryResults: Map<number, { success: boolean; error?: string; rowCount?: number }>;
  /** Map of guardrail filter index -> SQL validation result. */
  guardrailResults: Map<number, { valid: boolean; error?: string }>;
}

export interface SourceFileInfo {
  filePath: string;
  content: string;
}

export interface ContextGraph {
  models: Map<string, OsiSemanticModel>;
  governance: Map<string, GovernanceFile>;
  rules: Map<string, RulesFile>;
  lineage: Map<string, LineageFile>;
  terms: Map<string, TermFile>;
  owners: Map<string, OwnerFile>;
  tiers: Map<string, TierScore>;
  /** Maps synthetic keys (e.g. "model:retail-sales") to their source file info. */
  sourceMap: Map<string, SourceFileInfo>;
  indexes: {
    byOwner: Map<string, string[]>;
    byTag: Map<string, string[]>;
    byTrust: Map<string, string[]>;
    modelToGovernance: Map<string, string>;
    modelToRules: Map<string, string>;
    modelToLineage: Map<string, string>;
  };
  /** Optional data validation results from introspecting a live database. */
  dataValidation?: DataValidationInfo;
}
