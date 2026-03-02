import type { LintRule } from '../rule.js';

// Bronze rules
import { namingIdKebabCase } from './naming-id-kebab-case.js';
import { descriptionsRequired } from './descriptions-required.js';
import { ownershipRequired } from './ownership-required.js';
import { referencesResolvable } from './references-resolvable.js';
import { glossaryNoDuplicateTerms } from './glossary-no-duplicate-terms.js';
import { noSecrets } from './no-secrets.js';
import { osiValidSchema } from './osi-valid-schema.js';
import { governanceModelExists } from './governance-model-exists.js';
import { governanceDatasetsExist } from './governance-datasets-exist.js';
import { governanceFieldsExist } from './governance-fields-exist.js';
import { governanceGrainRequired } from './governance-grain-required.js';
import { governanceSecurityRequired } from './governance-security-required.js';

// Silver rules
import { governanceTrustRequired } from './governance-trust-required.js';
import { governanceRefreshRequired } from './governance-refresh-required.js';
import { lineageUpstreamRequired } from './lineage-upstream-required.js';

// Gold rules
import { governanceSemanticRoleRequired } from './governance-semantic-role-required.js';
import { governanceAggregationRequired } from './governance-aggregation-required.js';
import { governanceAdditiveRequired } from './governance-additive-required.js';
import { rulesGoldenQueriesMinimum } from './rules-golden-queries-minimum.js';
import { rulesBusinessRulesExist } from './rules-business-rules-exist.js';
import { rulesGuardrailsExist } from './rules-guardrails-exist.js';
import { rulesHierarchiesExist } from './rules-hierarchies-exist.js';

// Composite tier rules
import { tierBronze } from './tier-bronze.js';
import { tierSilver } from './tier-silver.js';
import { tierGold } from './tier-gold.js';

export {
  // Bronze
  namingIdKebabCase,
  descriptionsRequired,
  ownershipRequired,
  referencesResolvable,
  glossaryNoDuplicateTerms,
  noSecrets,
  osiValidSchema,
  governanceModelExists,
  governanceDatasetsExist,
  governanceFieldsExist,
  governanceGrainRequired,
  governanceSecurityRequired,
  // Silver
  governanceTrustRequired,
  governanceRefreshRequired,
  lineageUpstreamRequired,
  // Gold
  governanceSemanticRoleRequired,
  governanceAggregationRequired,
  governanceAdditiveRequired,
  rulesGoldenQueriesMinimum,
  rulesBusinessRulesExist,
  rulesGuardrailsExist,
  rulesHierarchiesExist,
  // Composite tier
  tierBronze,
  tierSilver,
  tierGold,
};

export const ALL_RULES: LintRule[] = [
  // Bronze (12)
  namingIdKebabCase,
  descriptionsRequired,
  ownershipRequired,
  referencesResolvable,
  glossaryNoDuplicateTerms,
  noSecrets,
  osiValidSchema,
  governanceModelExists,
  governanceDatasetsExist,
  governanceFieldsExist,
  governanceGrainRequired,
  governanceSecurityRequired,
  // Silver (3)
  governanceTrustRequired,
  governanceRefreshRequired,
  lineageUpstreamRequired,
  // Gold (7)
  governanceSemanticRoleRequired,
  governanceAggregationRequired,
  governanceAdditiveRequired,
  rulesGoldenQueriesMinimum,
  rulesBusinessRulesExist,
  rulesGuardrailsExist,
  rulesHierarchiesExist,
  // Composite tier (3)
  tierBronze,
  tierSilver,
  tierGold,
];
