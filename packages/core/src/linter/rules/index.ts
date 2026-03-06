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
import { governanceFieldDescriptionQuality } from './governance-field-description-quality.js';
import { glossaryDefinitionQuality } from './glossary-definition-quality.js';
import { lineageNoSelfReference } from './lineage-no-self-reference.js';
import { governanceGrainNoPlaceholder } from './governance-grain-no-placeholder.js';
import { osiRelationshipsCoverage } from './osi-relationships-coverage.js';
import { osiMetricsDefined } from './osi-metrics-defined.js';
import { glossaryCoverage } from './glossary-coverage.js';

// Data-aware rules (require dataValidation on the graph)
import { dataSourceExists } from './data-source-exists.js';
import { dataFieldsExist } from './data-fields-exist.js';
import { dataFieldTypesCompatible } from './data-field-types-compatible.js';
import { dataSampleValuesAccurate } from './data-sample-values-accurate.js';
import { dataGoldenQueriesExecute } from './data-golden-queries-execute.js';
import { dataGoldenQueriesNonempty } from './data-golden-queries-nonempty.js';
import { dataGuardrailsValidSql } from './data-guardrails-valid-sql.js';
import { dataRowCountsNonzero } from './data-row-counts-nonzero.js';

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
  governanceFieldDescriptionQuality,
  glossaryDefinitionQuality,
  lineageNoSelfReference,
  governanceGrainNoPlaceholder,
  osiRelationshipsCoverage,
  osiMetricsDefined,
  glossaryCoverage,
  // Data-aware
  dataSourceExists,
  dataFieldsExist,
  dataFieldTypesCompatible,
  dataSampleValuesAccurate,
  dataGoldenQueriesExecute,
  dataGoldenQueriesNonempty,
  dataGuardrailsValidSql,
  dataRowCountsNonzero,
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
  // Gold (14)
  governanceSemanticRoleRequired,
  governanceAggregationRequired,
  governanceAdditiveRequired,
  rulesGoldenQueriesMinimum,
  rulesBusinessRulesExist,
  rulesGuardrailsExist,
  rulesHierarchiesExist,
  governanceFieldDescriptionQuality,
  glossaryDefinitionQuality,
  lineageNoSelfReference,
  governanceGrainNoPlaceholder,
  osiRelationshipsCoverage,
  osiMetricsDefined,
  glossaryCoverage,
  // Data-aware (8)
  dataSourceExists,
  dataFieldsExist,
  dataFieldTypesCompatible,
  dataSampleValuesAccurate,
  dataGoldenQueriesExecute,
  dataGoldenQueriesNonempty,
  dataGuardrailsValidSql,
  dataRowCountsNonzero,
  // Composite tier (3)
  tierBronze,
  tierSilver,
  tierGold,
];
