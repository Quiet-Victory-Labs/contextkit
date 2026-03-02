import type { LintRule } from '../rule.js';

import { schemaValidYaml } from './schema-valid-yaml.js';
import { namingIdKebabCase } from './naming-id-kebab-case.js';
import { ownershipRequired } from './ownership-required.js';
import { descriptionsRequired } from './descriptions-required.js';
import { referencesResolvable } from './references-resolvable.js';
import { glossaryNoDuplicateTerms } from './glossary-no-duplicate-terms.js';
import { conceptsCertifiedRequiresEvidence } from './concepts-certified-requires-evidence.js';
import { policiesUnknownSubject } from './policies-unknown-subject.js';
import { policiesDenyOverridesAllow } from './policies-deny-overrides-allow.js';
import { docsExamplesRequired } from './docs-examples-required.js';
import { deprecationRequireSunset } from './deprecation-require-sunset.js';
import { packagingNoSecrets } from './packaging-no-secrets.js';

/**
 * All built-in lint rules, in a convenient array for bulk registration.
 */
export const ALL_RULES: LintRule[] = [
  schemaValidYaml,
  namingIdKebabCase,
  ownershipRequired,
  descriptionsRequired,
  referencesResolvable,
  glossaryNoDuplicateTerms,
  conceptsCertifiedRequiresEvidence,
  policiesUnknownSubject,
  policiesDenyOverridesAllow,
  docsExamplesRequired,
  deprecationRequireSunset,
  packagingNoSecrets,
];

// Re-export individual rules
export { schemaValidYaml } from './schema-valid-yaml.js';
export { namingIdKebabCase } from './naming-id-kebab-case.js';
export { ownershipRequired } from './ownership-required.js';
export { descriptionsRequired } from './descriptions-required.js';
export { referencesResolvable } from './references-resolvable.js';
export { glossaryNoDuplicateTerms } from './glossary-no-duplicate-terms.js';
export { conceptsCertifiedRequiresEvidence } from './concepts-certified-requires-evidence.js';
export { policiesUnknownSubject } from './policies-unknown-subject.js';
export { policiesDenyOverridesAllow } from './policies-deny-overrides-allow.js';
export { docsExamplesRequired } from './docs-examples-required.js';
export { deprecationRequireSunset } from './deprecation-require-sunset.js';
export { packagingNoSecrets } from './packaging-no-secrets.js';
