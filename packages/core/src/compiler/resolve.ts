import type { ContextGraph, Diagnostic, OsiSemanticModel } from '../types/index.js';

function diag(
  ruleId: string,
  message: string,
  file: string,
): Diagnostic {
  return {
    ruleId,
    severity: 'error',
    message,
    location: { file, line: 1, column: 1 },
    fixable: false,
  };
}

/** Get the set of dataset names from a model. */
function datasetNames(model: OsiSemanticModel): Set<string> {
  return new Set(model.datasets.map((d) => d.name));
}

/** Get the set of field names in a dataset, formatted as-is (just the field name). */
function fieldNamesInDataset(model: OsiSemanticModel, datasetName: string): Set<string> {
  const dataset = model.datasets.find((d) => d.name === datasetName);
  if (!dataset?.fields) return new Set();
  return new Set(dataset.fields.map((f) => f.name));
}

export function resolveReferences(graph: ContextGraph): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // --- Governance references ---
  for (const [key, gov] of graph.governance) {
    const file = `governance:${key}`;

    // governance.model must exist in graph.models
    if (!graph.models.has(gov.model)) {
      diagnostics.push(
        diag('references/model-exists', `Governance references model "${gov.model}" which does not exist`, file),
      );
    }

    // governance.owner must exist in graph.owners
    if (!graph.owners.has(gov.owner)) {
      diagnostics.push(
        diag('references/owner-exists', `Governance references owner "${gov.owner}" which does not exist`, file),
      );
    }

    // governance.datasets keys must match dataset names in the referenced model
    if (gov.datasets) {
      const model = graph.models.get(gov.model);
      const validDatasets = model ? datasetNames(model) : new Set<string>();
      for (const dsName of Object.keys(gov.datasets)) {
        if (!validDatasets.has(dsName)) {
          diagnostics.push(
            diag('references/dataset-exists', `Governance references dataset "${dsName}" which does not exist in model "${gov.model}"`, file),
          );
        }
      }
    }

    // governance.fields keys: "dataset.field" format
    if (gov.fields) {
      const model = graph.models.get(gov.model);
      for (const fieldKey of Object.keys(gov.fields)) {
        const parts = fieldKey.split('.');
        if (parts.length !== 2) continue; // schema validation already handles format
        const [dsName, fieldName] = parts as [string, string];
        const validDatasets = model ? datasetNames(model) : new Set<string>();
        if (!validDatasets.has(dsName)) {
          diagnostics.push(
            diag('references/dataset-exists', `Governance field key "${fieldKey}" references dataset "${dsName}" which does not exist in model "${gov.model}"`, file),
          );
        } else if (model) {
          const validFields = fieldNamesInDataset(model, dsName);
          if (!validFields.has(fieldName)) {
            diagnostics.push(
              diag('references/field-exists', `Governance field key "${fieldKey}" references field "${fieldName}" which does not exist in dataset "${dsName}"`, file),
            );
          }
        }
      }
    }
  }

  // --- Rules references ---
  for (const [key, rules] of graph.rules) {
    const file = `rules:${key}`;

    // rules.model must exist in graph.models
    if (!graph.models.has(rules.model)) {
      diagnostics.push(
        diag('references/model-exists', `Rules file references model "${rules.model}" which does not exist`, file),
      );
    }

    const model = graph.models.get(rules.model);
    const validDatasets = model ? datasetNames(model) : new Set<string>();

    // rules.business_rules[].tables must match dataset names
    if (rules.business_rules) {
      for (const rule of rules.business_rules) {
        if (rule.tables) {
          for (const table of rule.tables) {
            if (!validDatasets.has(table)) {
              diagnostics.push(
                diag('references/table-exists', `Business rule "${rule.name}" references table "${table}" which does not exist in model "${rules.model}"`, file),
              );
            }
          }
        }
      }
    }

    // rules.guardrail_filters[].tables must match dataset names
    if (rules.guardrail_filters) {
      for (const filter of rules.guardrail_filters) {
        if (filter.tables) {
          for (const table of filter.tables) {
            if (!validDatasets.has(table)) {
              diagnostics.push(
                diag('references/table-exists', `Guardrail filter "${filter.name}" references table "${table}" which does not exist in model "${rules.model}"`, file),
              );
            }
          }
        }
      }
    }

    // rules.hierarchies[].dataset must match dataset name
    if (rules.hierarchies) {
      for (const hierarchy of rules.hierarchies) {
        if (!validDatasets.has(hierarchy.dataset)) {
          diagnostics.push(
            diag('references/table-exists', `Hierarchy "${hierarchy.name}" references dataset "${hierarchy.dataset}" which does not exist in model "${rules.model}"`, file),
          );
        }
      }
    }
  }

  // --- Lineage references ---
  for (const [key, lineage] of graph.lineage) {
    const file = `lineage:${key}`;

    // lineage.model must exist in graph.models
    if (!graph.models.has(lineage.model)) {
      diagnostics.push(
        diag('references/model-exists', `Lineage file references model "${lineage.model}" which does not exist`, file),
      );
    }
  }

  // --- Term references ---
  for (const [key, term] of graph.terms) {
    const file = `term:${key}`;

    // term.owner must exist in graph.owners
    if (term.owner && !graph.owners.has(term.owner)) {
      diagnostics.push(
        diag('references/owner-exists', `Term "${term.id}" references owner "${term.owner}" which does not exist`, file),
      );
    }

    // term.maps_to must match other term IDs
    if (term.maps_to) {
      for (const targetId of term.maps_to) {
        if (!graph.terms.has(targetId)) {
          diagnostics.push(
            diag('references/term-exists', `Term "${term.id}" maps_to term "${targetId}" which does not exist`, file),
          );
        }
      }
    }
  }

  return diagnostics;
}
