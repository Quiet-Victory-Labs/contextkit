import type { LintRule } from '../rule.js';

/**
 * Placeholder rule for YAML schema validation.
 *
 * Schema validation diagnostics are produced during the compile phase
 * (Zod parsing). This rule exists so that users can see and configure
 * it in their lint config, but it never produces diagnostics itself.
 */
export const schemaValidYaml: LintRule = {
  id: 'schema/valid-yaml',
  defaultSeverity: 'error',
  fixable: false,
  description: 'Validates YAML against Zod schemas',

  run() {
    return [];
  },
};
