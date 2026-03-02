import type { ContextGraph, TierCheckResult, OsiSemanticModel } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all fully-qualified field names from a model: "dataset.field" */
function allFieldKeys(model: OsiSemanticModel): string[] {
  const keys: string[] = [];
  for (const ds of model.datasets) {
    for (const f of ds.fields ?? []) {
      keys.push(`${ds.name}.${f.name}`);
    }
  }
  return keys;
}

function pass(id: string, label: string): TierCheckResult {
  return { id, label, passed: true };
}

function fail(id: string, label: string, detail?: string): TierCheckResult {
  return { id, label, passed: false, detail };
}

// ---------------------------------------------------------------------------
// Bronze checks (7)
// ---------------------------------------------------------------------------

export function checkBronze(modelName: string, graph: ContextGraph): TierCheckResult[] {
  const results: TierCheckResult[] = [];
  const model = graph.models.get(modelName);
  const gov = graph.governance.get(modelName);

  // 1. Model has name and description
  {
    const id = 'bronze/model-description';
    const label = 'Model has name and description';
    if (model && model.name && model.description) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'Model is missing name or description'));
    }
  }

  // 2. All datasets have descriptions
  {
    const id = 'bronze/dataset-descriptions';
    const label = 'All datasets have descriptions';
    if (!model || model.datasets.length === 0) {
      results.push(fail(id, label, 'No model or datasets found'));
    } else {
      const missing = model.datasets.filter((ds) => !ds.description);
      if (missing.length === 0) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `Missing descriptions: ${missing.map((d) => d.name).join(', ')}`));
      }
    }
  }

  // 3. All fields have descriptions
  {
    const id = 'bronze/field-descriptions';
    const label = 'All fields have descriptions';
    if (!model) {
      results.push(fail(id, label, 'No model found'));
    } else {
      const allFields = model.datasets.flatMap((ds) => ds.fields ?? []);
      if (allFields.length === 0) {
        results.push(fail(id, label, 'No fields defined across any dataset'));
      } else {
        const missing: string[] = [];
        for (const ds of model.datasets) {
          for (const f of ds.fields ?? []) {
            if (!f.description) {
              missing.push(`${ds.name}.${f.name}`);
            }
          }
        }
        if (missing.length === 0) {
          results.push(pass(id, label));
        } else {
          results.push(fail(id, label, `Missing descriptions: ${missing.join(', ')}`));
        }
      }
    }
  }

  // 4. Owner assigned and resolvable
  {
    const id = 'bronze/owner-resolvable';
    const label = 'Owner assigned and resolvable';
    if (gov && gov.owner && graph.owners.has(gov.owner)) {
      results.push(pass(id, label));
    } else if (gov && gov.owner) {
      results.push(fail(id, label, `Owner '${gov.owner}' not found in owners`));
    } else {
      results.push(fail(id, label, 'No governance or owner assigned'));
    }
  }

  // 5. Security classification set
  {
    const id = 'bronze/security-classification';
    const label = 'Security classification set';
    if (gov && gov.security) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No security classification in governance'));
    }
  }

  // 6. All datasets have grain statements
  {
    const id = 'bronze/dataset-grain';
    const label = 'All datasets have grain statements';
    if (!gov || !gov.datasets) {
      results.push(fail(id, label, 'No governance datasets'));
    } else if (!model) {
      results.push(fail(id, label, 'No model found'));
    } else {
      const missing: string[] = [];
      for (const ds of model.datasets) {
        const dsGov = gov.datasets[ds.name];
        if (!dsGov || !dsGov.grain) {
          missing.push(ds.name);
        }
      }
      if (missing.length === 0) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `Missing grain: ${missing.join(', ')}`));
      }
    }
  }

  // 7. All datasets have table_type
  {
    const id = 'bronze/dataset-table-type';
    const label = 'All datasets have table_type';
    if (!gov || !gov.datasets) {
      results.push(fail(id, label, 'No governance datasets'));
    } else if (!model) {
      results.push(fail(id, label, 'No model found'));
    } else {
      const missing: string[] = [];
      for (const ds of model.datasets) {
        const dsGov = gov.datasets[ds.name];
        if (!dsGov || !dsGov.table_type) {
          missing.push(ds.name);
        }
      }
      if (missing.length === 0) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `Missing table_type: ${missing.join(', ')}`));
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Silver checks (6)
// ---------------------------------------------------------------------------

export function checkSilver(modelName: string, graph: ContextGraph): TierCheckResult[] {
  const results: TierCheckResult[] = [];
  const model = graph.models.get(modelName);
  const gov = graph.governance.get(modelName);
  const lineageKey = graph.indexes.modelToLineage.get(modelName);
  const lineage = lineageKey ? graph.lineage.get(lineageKey) : undefined;

  // 1. Trust status is set
  {
    const id = 'silver/trust-status';
    const label = 'Trust status is set';
    if (gov && gov.trust) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No trust status in governance'));
    }
  }

  // 2. At least 2 tags
  {
    const id = 'silver/min-tags';
    const label = 'At least 2 tags';
    if (gov && gov.tags && gov.tags.length >= 2) {
      results.push(pass(id, label));
    } else {
      const count = gov?.tags?.length ?? 0;
      results.push(fail(id, label, `Found ${count} tag(s), need at least 2`));
    }
  }

  // 3. Glossary term linked (tags overlap or owner overlap)
  {
    const id = 'silver/glossary-linked';
    const label = 'Glossary term linked';
    let linked = false;
    const govTags = new Set(gov?.tags ?? []);
    const govOwner = gov?.owner;

    for (const [, term] of graph.terms) {
      // Check tag overlap
      if (term.tags) {
        for (const tag of term.tags) {
          if (govTags.has(tag)) {
            linked = true;
            break;
          }
        }
      }
      // Check owner overlap
      if (term.owner && term.owner === govOwner) {
        linked = true;
      }
      if (linked) break;
    }

    if (graph.terms.size === 0) {
      results.push(fail(id, label, 'No glossary terms defined'));
    } else if (linked) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No glossary term shares tags or owner with this model'));
    }
  }

  // 4. Upstream lineage exists
  {
    const id = 'silver/upstream-lineage';
    const label = 'Upstream lineage exists';
    if (lineage && lineage.upstream && lineage.upstream.length > 0) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No upstream lineage defined'));
    }
  }

  // 5. All datasets have refresh cadence
  {
    const id = 'silver/dataset-refresh';
    const label = 'All datasets have refresh cadence';
    if (!gov || !gov.datasets || !model) {
      results.push(fail(id, label, 'No governance datasets or model'));
    } else {
      const missing: string[] = [];
      for (const ds of model.datasets) {
        const dsGov = gov.datasets[ds.name];
        if (!dsGov || !dsGov.refresh) {
          missing.push(ds.name);
        }
      }
      if (missing.length === 0) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `Missing refresh: ${missing.join(', ')}`));
      }
    }
  }

  // 6. At least 2 fields have sample_values
  {
    const id = 'silver/sample-values';
    const label = 'At least 2 fields have sample_values';
    let count = 0;
    if (gov && gov.fields) {
      for (const [, fg] of Object.entries(gov.fields)) {
        if (fg.sample_values && fg.sample_values.length > 0) {
          count++;
        }
      }
    }
    if (count >= 2) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, `Found ${count} field(s) with sample_values, need at least 2`));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Gold checks (10)
// ---------------------------------------------------------------------------

export function checkGold(modelName: string, graph: ContextGraph): TierCheckResult[] {
  const results: TierCheckResult[] = [];
  const model = graph.models.get(modelName);
  const gov = graph.governance.get(modelName);
  const rulesKey = graph.indexes.modelToRules.get(modelName);
  const rules = rulesKey ? graph.rules.get(rulesKey) : undefined;

  const fieldKeys = model ? allFieldKeys(model) : [];

  // 1. Every field has semantic_role
  {
    const id = 'gold/field-semantic-role';
    const label = 'Every field has semantic_role';
    if (!gov || !gov.fields) {
      results.push(fail(id, label, 'No governance fields'));
    } else if (fieldKeys.length === 0) {
      results.push(fail(id, label, 'Model has no fields to verify'));
    } else {
      const missing = fieldKeys.filter((k) => !gov.fields![k]?.semantic_role);
      if (missing.length === 0) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `Missing semantic_role: ${missing.join(', ')}`));
      }
    }
  }

  // 2. Every metric field has default_aggregation
  {
    const id = 'gold/metric-aggregation';
    const label = 'Every metric field has default_aggregation';
    if (!gov || !gov.fields) {
      results.push(fail(id, label, 'No governance fields'));
    } else {
      const metricFields = Object.entries(gov.fields).filter(([, fg]) => fg.semantic_role === 'metric');
      if (metricFields.length === 0) {
        results.push(fail(id, label, 'No metric fields found'));
      } else {
        const missing = metricFields.filter(([, fg]) => !fg.default_aggregation);
        if (missing.length === 0) {
          results.push(pass(id, label));
        } else {
          results.push(fail(id, label, `Missing default_aggregation: ${missing.map(([k]) => k).join(', ')}`));
        }
      }
    }
  }

  // 3. Every metric field has additive flag
  {
    const id = 'gold/metric-additive';
    const label = 'Every metric field has additive flag';
    if (!gov || !gov.fields) {
      results.push(fail(id, label, 'No governance fields'));
    } else {
      const metricFields = Object.entries(gov.fields).filter(([, fg]) => fg.semantic_role === 'metric');
      if (metricFields.length === 0) {
        results.push(fail(id, label, 'No metric fields found'));
      } else {
        const missing = metricFields.filter(([, fg]) => fg.additive === undefined);
        if (missing.length === 0) {
          results.push(pass(id, label));
        } else {
          results.push(fail(id, label, `Missing additive flag: ${missing.map(([k]) => k).join(', ')}`));
        }
      }
    }
  }

  // 4. At least 1 guardrail_filter exists
  {
    const id = 'gold/guardrail-filter';
    const label = 'At least 1 guardrail_filter exists';
    if (rules && rules.guardrail_filters && rules.guardrail_filters.length >= 1) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No guardrail filters found'));
    }
  }

  // 5. At least 3 golden_queries exist
  {
    const id = 'gold/golden-queries';
    const label = 'At least 3 golden_queries exist';
    const count = rules?.golden_queries?.length ?? 0;
    if (count >= 3) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, `Found ${count} golden queries, need at least 3`));
    }
  }

  // 6. At least 1 business_rule exists
  {
    const id = 'gold/business-rule';
    const label = 'At least 1 business_rule exists';
    if (rules && rules.business_rules && rules.business_rules.length >= 1) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No business rules found'));
    }
  }

  // 7. At least 1 hierarchy exists
  {
    const id = 'gold/hierarchy';
    const label = 'At least 1 hierarchy exists';
    if (rules && rules.hierarchies && rules.hierarchies.length >= 1) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No hierarchies found'));
    }
  }

  // 8. At least 1 field has default_filter
  {
    const id = 'gold/default-filter';
    const label = 'At least 1 field has default_filter';
    let found = false;
    if (gov && gov.fields) {
      for (const [, fg] of Object.entries(gov.fields)) {
        if (fg.default_filter) {
          found = true;
          break;
        }
      }
    }
    if (found) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No fields have default_filter'));
    }
  }

  // 9. Trust is endorsed
  {
    const id = 'gold/trust-endorsed';
    const label = 'Trust is endorsed';
    if (gov && gov.trust === 'endorsed') {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, `Trust is '${gov?.trust ?? 'unset'}', not 'endorsed'`));
    }
  }

  // 10. Security controls adequate (security classification set at model or dataset level)
  {
    const id = 'gold/security-controls';
    const label = 'Security controls adequate';
    const hasModelSecurity = !!(gov && gov.security);
    let hasDatasetSecurity = false;
    if (gov && gov.datasets) {
      for (const [, dsGov] of Object.entries(gov.datasets)) {
        if (dsGov.security) {
          hasDatasetSecurity = true;
          break;
        }
      }
    }
    if (hasModelSecurity || hasDatasetSecurity) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No security classification at model or dataset level'));
    }
  }

  return results;
}
