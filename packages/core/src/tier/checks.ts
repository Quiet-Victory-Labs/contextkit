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

/** Returns true if any string field in the object contains "TODO" (case-insensitive). */
function hasTodo(obj: Record<string, unknown>): boolean {
  for (const val of Object.values(obj)) {
    if (typeof val === 'string' && val.toLowerCase().includes('todo')) return true;
  }
  return false;
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
// Gold checks (24)
// ---------------------------------------------------------------------------

export function checkGold(modelName: string, graph: ContextGraph): TierCheckResult[] {
  const results: TierCheckResult[] = [];
  const model = graph.models.get(modelName);
  const gov = graph.governance.get(modelName);
  const rulesKey = graph.indexes.modelToRules.get(modelName);
  const rules = rulesKey ? graph.rules.get(rulesKey) : undefined;
  const owner = gov?.owner ? graph.owners.get(gov.owner) : undefined;

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
        const shown = missing.slice(0, 5).join(', ');
        const extra = missing.length > 5 ? ` and ${missing.length - 5} more` : '';
        results.push(fail(id, label, `Missing semantic_role: ${shown}${extra}`));
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
          const shown = missing.slice(0, 5).map(([k]) => k).join(', ');
          const extra = missing.length > 5 ? ` and ${missing.length - 5} more` : '';
          results.push(fail(id, label, `Missing default_aggregation: ${shown}${extra}`));
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
          const shown = missing.slice(0, 5).map(([k]) => k).join(', ');
          const extra = missing.length > 5 ? ` and ${missing.length - 5} more` : '';
          results.push(fail(id, label, `Missing additive flag: ${shown}${extra}`));
        }
      }
    }
  }

  // 4. At least 1 guardrail_filter exists (no TODOs)
  {
    const id = 'gold/guardrail-filter';
    const label = 'At least 1 guardrail_filter exists';
    const real = (rules?.guardrail_filters ?? []).filter((g) => !hasTodo(g as unknown as Record<string, unknown>));
    const todoCount = (rules?.guardrail_filters?.length ?? 0) - real.length;
    if (real.length >= 1) {
      results.push(pass(id, label));
    } else if (todoCount > 0) {
      results.push(fail(id, label, `Found ${todoCount} guardrail filter(s) but all contain TODO placeholders`));
    } else {
      results.push(fail(id, label, 'No guardrail filters found'));
    }
  }

  // 5. At least 3 golden_queries exist (no TODOs)
  {
    const id = 'gold/golden-queries';
    const label = 'At least 3 golden_queries exist';
    const all = rules?.golden_queries ?? [];
    const real = all.filter((g) => !hasTodo(g as unknown as Record<string, unknown>));
    const todoCount = all.length - real.length;
    if (real.length >= 3) {
      results.push(pass(id, label));
    } else if (todoCount > 0) {
      results.push(fail(id, label, `Found ${real.length} real golden queries (${todoCount} are TODO placeholders), need at least 3`));
    } else {
      results.push(fail(id, label, `Found ${real.length} golden queries, need at least 3`));
    }
  }

  // 6. At least 1 business_rule exists (no TODOs)
  {
    const id = 'gold/business-rule';
    const label = 'At least 1 business_rule exists';
    const all = rules?.business_rules ?? [];
    const real = all.filter((b) => !hasTodo(b as unknown as Record<string, unknown>));
    const todoCount = all.length - real.length;
    if (real.length >= 1) {
      results.push(pass(id, label));
    } else if (todoCount > 0) {
      results.push(fail(id, label, `Found ${todoCount} business rule(s) but all contain TODO placeholders`));
    } else {
      results.push(fail(id, label, 'No business rules found'));
    }
  }

  // 7. At least 1 hierarchy exists (no TODOs)
  {
    const id = 'gold/hierarchy';
    const label = 'At least 1 hierarchy exists';
    const all = rules?.hierarchies ?? [];
    const real = all.filter((h) => !hasTodo(h as unknown as Record<string, unknown>));
    const todoCount = all.length - real.length;
    if (real.length >= 1) {
      results.push(pass(id, label));
    } else if (todoCount > 0) {
      results.push(fail(id, label, `Found ${todoCount} hierarchy(s) but all contain TODO placeholders`));
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

  // 11. Owner is contactable (has email, not a placeholder name)
  {
    const id = 'gold/owner-contactable';
    const label = 'Owner is contactable';
    const placeholders = ['default-team', 'default', 'tbd', 'todo', 'unknown'];
    if (owner && owner.email && !placeholders.includes(owner.id.toLowerCase())) {
      results.push(pass(id, label));
    } else if (!owner) {
      results.push(fail(id, label, 'Owner not found'));
    } else if (placeholders.includes(owner.id.toLowerCase())) {
      results.push(fail(id, label, `Owner '${owner.id}' is a placeholder name`));
    } else {
      results.push(fail(id, label, `Owner '${owner.id}' has no email`));
    }
  }

  // 12. At least 1 relationship defined in the OSI model
  {
    const id = 'gold/relationships-defined';
    const label = 'At least 1 relationship defined';
    const rels = model?.relationships ?? [];
    if (rels.length >= 1) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No relationships defined in the OSI model'));
    }
  }

  // 13. Model description is at least 50 characters
  {
    const id = 'gold/model-description-quality';
    const label = 'Model description is at least 50 characters';
    const desc = model?.description ?? '';
    if (desc.length >= 50) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, `Description is ${desc.length} chars, need at least 50`));
    }
  }

  // 14. Model has ai_context defined
  {
    const id = 'gold/ai-context-exists';
    const label = 'Model has ai_context';
    if (model?.ai_context) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No ai_context on model'));
    }
  }

  // 15. Governance has at least 1 business_context entry (no TODOs)
  {
    const id = 'gold/business-context';
    const label = 'At least 1 business_context narrative';
    const all = gov?.business_context ?? [];
    const real = all.filter((bc) => !hasTodo(bc as unknown as Record<string, unknown>));
    const todoCount = all.length - real.length;
    if (real.length >= 1) {
      results.push(pass(id, label));
    } else if (todoCount > 0) {
      results.push(fail(id, label, `Found ${todoCount} business_context entries but all contain TODO placeholders`));
    } else {
      results.push(fail(id, label, 'No business_context entries in governance'));
    }
  }

  // 16. Governance has version set
  {
    const id = 'gold/model-version';
    const label = 'Data product version is set';
    if (gov?.version) {
      results.push(pass(id, label));
    } else {
      results.push(fail(id, label, 'No version in governance'));
    }
  }

  // 17. Field descriptions must not just repeat the field name
  {
    const id = 'gold/field-description-quality';
    const label = 'Field descriptions are meaningful';
    if (!model) {
      results.push(fail(id, label, 'No model found'));
    } else {
      const lazy: string[] = [];
      const normalize = (s: string) => s.toLowerCase().replace(/[-_ ]/g, '');
      for (const ds of model.datasets) {
        for (const f of ds.fields ?? []) {
          if (!f.description || f.description.length < 10 || normalize(f.description) === normalize(f.name)) {
            lazy.push(`${ds.name}.${f.name}`);
          }
        }
      }
      if (lazy.length === 0) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `${lazy.length} field(s) have lazy descriptions (just the column name or under 10 chars): ${lazy.slice(0, 5).join(', ')}${lazy.length > 5 ? ` and ${lazy.length - 5} more` : ''}`));
      }
    }
  }

  // 18. Glossary definitions must be substantive
  {
    const id = 'gold/glossary-definition-quality';
    const label = 'Glossary definitions are substantive';
    const govOwner = gov?.owner;
    const govTags = new Set(gov?.tags ?? []);
    const relatedTerms: Array<{ id: string; definition: string }> = [];

    for (const [, term] of graph.terms) {
      let related = false;
      if (term.owner && term.owner === govOwner) related = true;
      if (term.tags) {
        for (const tag of term.tags) {
          if (govTags.has(tag)) { related = true; break; }
        }
      }
      if (related) relatedTerms.push(term);
    }

    if (relatedTerms.length === 0) {
      results.push(pass(id, label)); // No terms to check — glossary linking is a Silver check
    } else {
      const lazy = relatedTerms.filter((t) =>
        t.definition.length < 20 || /^definition (for|of) /i.test(t.definition),
      );
      if (lazy.length === 0) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `${lazy.length} glossary term(s) have placeholder definitions: ${lazy.map((t) => t.id).join(', ')}`));
      }
    }
  }

  // 19. Upstream lineage must not be self-referencing dataset names
  {
    const id = 'gold/lineage-no-self-reference';
    const label = 'Lineage references real upstream sources';
    const lineageKey = graph.indexes.modelToLineage.get(modelName);
    const lineage = lineageKey ? graph.lineage.get(lineageKey) : undefined;
    const dsNames = new Set(model?.datasets.map((ds) => ds.name) ?? []);

    if (!lineage || !lineage.upstream || lineage.upstream.length === 0) {
      results.push(pass(id, label)); // Lineage existence is a Silver check
    } else {
      const selfRefs = lineage.upstream.filter((u) => dsNames.has(u.source));
      const templateNotes = lineage.upstream.filter((u) => /^upstream source for /i.test(u.notes ?? ''));
      if (selfRefs.length > 0) {
        results.push(fail(id, label, `${selfRefs.length} upstream source(s) reference dataset names from this model instead of real external sources: ${selfRefs.map((u) => u.source).slice(0, 5).join(', ')}`));
      } else if (templateNotes.length === lineage.upstream.length) {
        results.push(fail(id, label, 'All upstream notes are template placeholders ("Upstream source for ...")'));
      } else {
        results.push(pass(id, label));
      }
    }
  }

  // 20. Grain statements must not be scaffold placeholders
  {
    const id = 'gold/grain-no-placeholder';
    const label = 'Grain statements are specific';
    if (!gov || !gov.datasets || !model) {
      results.push(fail(id, label, 'No governance datasets'));
    } else {
      const placeholder: string[] = [];
      for (const ds of model.datasets) {
        const dsGov = gov.datasets[ds.name];
        if (dsGov?.grain && dsGov.grain.toLowerCase().includes('no primary key detected')) {
          placeholder.push(ds.name);
        }
      }
      if (placeholder.length === 0) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `${placeholder.length} dataset(s) have placeholder grain ("no primary key detected"): ${placeholder.join(', ')}`));
      }
    }
  }

  // 21. ai_context must not contain TODO
  {
    const id = 'gold/ai-context-no-todo';
    const label = 'ai_context is filled in (no TODO)';
    const aiCtx = model?.ai_context;
    const aiCtxStr = typeof aiCtx === 'string' ? aiCtx : aiCtx?.instructions ?? '';
    if (!aiCtx) {
      results.push(pass(id, label)); // ai_context existence is checked by gold/ai-context-exists
    } else if (aiCtxStr.toLowerCase().includes('todo')) {
      results.push(fail(id, label, 'ai_context contains TODO placeholder'));
    } else {
      results.push(pass(id, label));
    }
  }

  // 22. Models with 3+ datasets must define at least 3 relationships
  {
    const id = 'gold/relationships-coverage';
    const label = 'Models with 3+ datasets have at least 3 relationships';
    const dsCount = model?.datasets.length ?? 0;
    if (dsCount < 3) {
      results.push(pass(id, label));
    } else {
      const relCount = model?.relationships?.length ?? 0;
      if (relCount >= 3) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `Model has ${dsCount} datasets but only ${relCount} relationships; models with 3+ datasets need at least 3`));
      }
    }
  }

  // 23. At least 1 computed metric (no TODOs)
  {
    const id = 'gold/metrics-defined';
    const label = 'At least 1 computed metric defined';
    const all = model?.metrics ?? [];
    const real = all.filter((m) => !hasTodo(m as unknown as Record<string, unknown>));
    const todoCount = all.length - real.length;
    if (real.length >= 1) {
      results.push(pass(id, label));
    } else if (todoCount > 0) {
      results.push(fail(id, label, `Found ${todoCount} metric(s) but all contain TODO placeholders`));
    } else {
      results.push(fail(id, label, 'No computed metrics defined; add reusable measures in metrics[]'));
    }
  }

  // 24. Models with 5+ datasets must have at least 3 linked glossary terms
  {
    const id = 'gold/glossary-coverage';
    const label = 'Complex models have adequate glossary coverage';
    const dsCount = model?.datasets.length ?? 0;
    if (dsCount < 5) {
      results.push(pass(id, label));
    } else {
      const govTags = new Set(gov?.tags ?? []);
      const govOwner = gov?.owner;
      let linkedCount = 0;

      for (const [, term] of graph.terms) {
        let linked = false;
        if (term.tags) {
          for (const tag of term.tags) {
            if (govTags.has(tag)) {
              linked = true;
              break;
            }
          }
        }
        if (term.owner && term.owner === govOwner) {
          linked = true;
        }
        if (linked) linkedCount++;
      }

      if (linkedCount >= 3) {
        results.push(pass(id, label));
      } else {
        results.push(fail(id, label, `Model has ${dsCount} datasets but only ${linkedCount} glossary terms; complex models need at least 3`));
      }
    }
  }

  return results;
}
