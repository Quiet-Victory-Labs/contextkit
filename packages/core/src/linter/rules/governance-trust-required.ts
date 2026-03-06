import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';
import { insertTopLevelKey, readFileContent } from '../../fixer/yaml-locate.js';

export const governanceTrustRequired: LintRule = {
  id: 'governance/trust-required',
  defaultSeverity: 'warning',
  description: 'Governance files must have a trust status set (endorsed/warning/deprecated)',
  fixable: true,
  tier: 'silver',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, gov] of graph.governance) {
      if (!gov.trust) {
        const syntheticFile = `governance:${key}`;
        const source = graph.sourceMap.get(syntheticFile);

        if (source) {
          const content = readFileContent(source.filePath);
          const edit = insertTopLevelKey(content, 'trust', 'warning');
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Governance for model "${gov.model}" is missing a trust status (endorsed/warning/deprecated)`,
            location: { file: source.filePath, line: 1, column: 1 },
            fixable: true,
            fix: {
              description: 'Add trust: warning',
              edits: [edit],
            },
          });
        } else {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Governance for model "${gov.model}" is missing a trust status (endorsed/warning/deprecated)`,
            location: { file: syntheticFile, line: 1, column: 1 },
            fixable: false,
          });
        }
      }
    }

    return diagnostics;
  },
};
