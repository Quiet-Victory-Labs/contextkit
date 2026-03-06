import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';
import { insertTopLevelKey, readFileContent } from '../../fixer/yaml-locate.js';

export const governanceSecurityRequired: LintRule = {
  id: 'governance/security-required',
  defaultSeverity: 'warning',
  description: 'Every governance file must have a security classification',
  fixable: true,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.security) {
        const syntheticFile = `governance:${key}`;
        const source = graph.sourceMap.get(syntheticFile);

        if (source) {
          const content = readFileContent(source.filePath);
          const edit = insertTopLevelKey(content, 'security', 'internal');
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Governance for model "${gov.model}" is missing a security classification`,
            location: { file: source.filePath, line: 1, column: 1 },
            fixable: true,
            fix: {
              description: 'Add security: internal',
              edits: [edit],
            },
          });
        } else {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Governance for model "${gov.model}" is missing a security classification`,
            location: { file: syntheticFile, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
