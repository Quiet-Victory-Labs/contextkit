import type { LintRule } from '../rule.js';

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

export {
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
};

export const ALL_RULES: LintRule[] = [
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
];
