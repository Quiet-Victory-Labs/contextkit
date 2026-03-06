import type { ContextGraph, Diagnostic } from '../../types/index.js';
import type { LintRule } from '../rule.js';
import { insertTopLevelKey, readFileContent } from '../../fixer/yaml-locate.js';

export const descriptionsRequired: LintRule = {
  id: 'osi/descriptions-required',
  defaultSeverity: 'warning',
  description: 'OSI models, datasets, and fields must have descriptions',
  fixable: true,
  tier: 'bronze',
  run(graph: ContextGraph): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [key, model] of graph.models) {
      const syntheticFile = `model:${key}`;
      const source = graph.sourceMap.get(syntheticFile);

      if (!model.description) {
        if (source) {
          const content = readFileContent(source.filePath);
          const edit = insertTopLevelKey(content, 'description', '"TODO"');
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Model "${model.name}" is missing a description`,
            location: { file: source.filePath, line: 1, column: 1 },
            fixable: true,
            fix: {
              description: `Add description to model "${model.name}"`,
              edits: [edit],
            },
          });
        } else {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Model "${model.name}" is missing a description`,
            location: { file: syntheticFile, line: 1, column: 1 },
            fixable: false,
          });
        }
      }

      for (const dataset of model.datasets) {
        if (!dataset.description) {
          diagnostics.push({
            ruleId: this.id,
            severity: this.defaultSeverity,
            message: `Dataset "${dataset.name}" in model "${model.name}" is missing a description`,
            location: { file: source?.filePath ?? syntheticFile, line: 1, column: 1 },
            fixable: false,
          });
        }

        if (dataset.fields) {
          for (const field of dataset.fields) {
            if (!field.description) {
              diagnostics.push({
                ruleId: this.id,
                severity: this.defaultSeverity,
                message: `Field "${field.name}" in dataset "${dataset.name}" of model "${model.name}" is missing a description`,
                location: { file: source?.filePath ?? syntheticFile, line: 1, column: 1 },
                fixable: false,
              });
            }
          }
        }
      }
    }

    return diagnostics;
  },
};
