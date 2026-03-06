import * as p from '@clack/prompts';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import * as yaml from 'yaml';
import {
  compile,
  computeTier,
  suggestEnrichments,
  inferSemanticRole,
  inferAggregation,
  loadConfig,
} from '@runcontext/core';
import type { SetupContext, StepResult } from '../types.js';
import { displayTierScore } from '../display.js';

function findFileRecursive(dir: string, suffix: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, suffix);
      if (found) return found;
    } else if (entry.name.endsWith(suffix)) {
      return fullPath;
    }
  }
  return undefined;
}

export async function runEnrichGoldStep(ctx: SetupContext): Promise<StepResult> {
  const config = loadConfig(ctx.cwd);
  const { graph } = await compile({ contextDir: ctx.contextDir, config, rootDir: ctx.cwd });
  ctx.graph = graph;
  const tierScore = computeTier(ctx.modelName, graph);

  if (tierScore.gold.passed) {
    p.log.success('Already at Gold — skipping.');
    ctx.tierScore = tierScore;
    return { skipped: true, summary: 'Already Gold' };
  }

  const model = graph.models.get(ctx.modelName);
  if (!model) {
    p.log.error(`Model "${ctx.modelName}" not found.`);
    return { skipped: true, summary: 'Model not found' };
  }

  const datasetNames = model.datasets.map((d) => d.name);
  const suggestions = suggestEnrichments('gold', tierScore, datasetNames);

  // Build preview
  const preview: string[] = [];
  if (suggestions.needsSemanticRoles) preview.push('+ Infer semantic_role for all fields');
  if (suggestions.needsRulesFile) preview.push('+ Generate rules file (golden queries, guardrails, hierarchies)');
  if (suggestions.governance?.trust) preview.push(`+ trust: ${suggestions.governance.trust}`);
  preview.push('+ Add version, business_context stubs to governance');
  preview.push('+ Add ai_context placeholder to model');
  preview.push('+ Infer relationships from column name patterns');

  if (preview.length > 0) {
    p.note(preview.join('\n'), 'Gold Enrichments');
  }

  p.log.warning('Gold enrichments create TODO placeholders that need manual curation.');

  const shouldRun = await p.confirm({
    message: 'Apply Gold enrichments?',
  });
  if (p.isCancel(shouldRun) || !shouldRun) {
    return { skipped: true, summary: 'Skipped' };
  }

  const spin = p.spinner();
  spin.start('Enriching to Gold...');

  // Apply governance changes
  const govFilePath = findFileRecursive(ctx.contextDir, `${ctx.modelName}.governance.yaml`);
  if (govFilePath) {
    const govContent = readFileSync(govFilePath, 'utf-8');
    const govDoc = yaml.parse(govContent) ?? {};

    if (suggestions.governance?.trust) govDoc.trust = suggestions.governance.trust;

    // Infer semantic roles for all fields
    if (suggestions.needsSemanticRoles) {
      govDoc.fields = govDoc.fields ?? {};

      for (const ds of model.datasets) {
        const tableName = ds.source?.split('.').pop() ?? ds.name;
        let dbColumns: any[] = [];
        try {
          dbColumns = await ctx.adapter.listColumns(tableName);
        } catch {
          // fall back to name-based heuristics
        }

        for (const field of ds.fields ?? []) {
          const fieldKey = `${ds.name}.${field.name}`;
          if (govDoc.fields[fieldKey]?.semantic_role) continue;
          const col = dbColumns.find((c: any) => c.name === field.name);
          const isPK = col?.is_primary_key ?? field.name.endsWith('_id');
          const dataType = col?.data_type ?? 'VARCHAR';
          govDoc.fields[fieldKey] = govDoc.fields[fieldKey] ?? {};
          const role = inferSemanticRole(field.name, dataType, isPK);
          govDoc.fields[fieldKey].semantic_role = role;
          if (role === 'metric') {
            govDoc.fields[fieldKey].default_aggregation = inferAggregation(field.name);
            govDoc.fields[fieldKey].additive = govDoc.fields[fieldKey].default_aggregation === 'SUM';
          }
        }
      }
    }

    // Add version if missing
    if (!govDoc.version) {
      govDoc.version = '0.1.0';
    }

    // Add business_context stubs if missing
    if (!govDoc.business_context || govDoc.business_context.length === 0) {
      govDoc.business_context = [
        { name: 'TODO: Use Case Name', description: 'TODO: Describe the analytical use case and business value.' },
      ];
    }

    writeFileSync(govFilePath, yaml.stringify(govDoc, { lineWidth: 120 }), 'utf-8');
  }

  // Add ai_context to model if missing
  const modelFilePath = findFileRecursive(ctx.contextDir, `${ctx.modelName}.osi.yaml`);
  if (modelFilePath) {
    const modelContent = readFileSync(modelFilePath, 'utf-8');
    const modelDoc = yaml.parse(modelContent) ?? {};
    const semModels = modelDoc.semantic_model ?? [];
    let changed = false;

    for (const sm of semModels) {
      if (sm.name !== ctx.modelName) continue;

      // Add ai_context placeholder if missing
      if (!sm.ai_context) {
        sm.ai_context = 'TODO: Describe how an AI agent should use this model, common pitfalls, and important filters.';
        changed = true;
      }

      // Infer relationships from column name patterns (e.g., business_id → FK to yelp_business)
      if (!sm.relationships || sm.relationships.length === 0) {
        const datasets = sm.datasets ?? [];
        const dsNames = new Set(datasets.map((d: any) => d.name));
        const inferred: any[] = [];

        for (const ds of datasets) {
          for (const field of ds.fields ?? []) {
            const fname = field.name as string;
            // Match patterns like "business_id" → look for dataset "business" or similar
            const idMatch = fname.match(/^(.+)_id$/);
            if (idMatch && idMatch[1]) {
              const targetBase = idMatch[1];
              // Find a dataset that matches the target name
              for (const targetDs of datasets) {
                if (targetDs.name === ds.name) continue;
                const targetName = targetDs.name as string;
                // Match if target dataset name contains the base or vice versa
                if (targetName.includes(targetBase) || targetBase.includes(targetName)) {
                  // Check target has a matching field
                  const targetHasField = (targetDs.fields ?? []).some((f: any) => f.name === fname);
                  if (targetHasField) {
                    const relName = `${ds.name}-to-${targetName}`;
                    if (!inferred.some((r: any) => r.name === relName)) {
                      inferred.push({
                        name: relName,
                        from: ds.name,
                        to: targetName,
                        from_columns: [fname],
                        to_columns: [fname],
                      });
                    }
                  }
                }
              }
            }
          }
        }

        if (inferred.length > 0) {
          sm.relationships = inferred;
          changed = true;
        }
      }
    }

    if (changed) {
      writeFileSync(modelFilePath, yaml.stringify(modelDoc, { lineWidth: 120 }), 'utf-8');
    }
  }

  // Stub rules file
  if (suggestions.needsRulesFile) {
    const rulesDir = path.join(ctx.contextDir, 'rules');
    if (!existsSync(rulesDir)) mkdirSync(rulesDir, { recursive: true });
    const rulesPath = path.join(rulesDir, `${ctx.modelName}.rules.yaml`);
    if (!existsSync(rulesPath)) {
      const rulesDoc = {
        model: ctx.modelName,
        golden_queries: [
          { question: 'TODO: What is the total count?', sql: 'SELECT COUNT(*) FROM table_name' },
          { question: 'TODO: What are the top records?', sql: 'SELECT * FROM table_name LIMIT 10' },
          { question: 'TODO: What is the distribution?', sql: 'SELECT column, COUNT(*) FROM table_name GROUP BY column' },
        ],
        business_rules: [
          { name: 'TODO: rule-name', definition: 'TODO: describe the business rule' },
        ],
        guardrail_filters: [
          { name: 'TODO: filter-name', filter: 'column IS NOT NULL', reason: 'TODO: explain why' },
        ],
        hierarchies: [
          { name: 'TODO: hierarchy-name', levels: ['level1', 'level2'], dataset: datasetNames[0] ?? 'dataset' },
        ],
      };
      writeFileSync(rulesPath, yaml.stringify(rulesDoc, { lineWidth: 120 }), 'utf-8');
    }
  }

  // Recompile and score
  const { graph: newGraph } = await compile({ contextDir: ctx.contextDir, config, rootDir: ctx.cwd });
  ctx.graph = newGraph;
  ctx.tierScore = computeTier(ctx.modelName, newGraph);

  spin.stop('Applied Gold enrichments');

  const todos = suggestions.needsRulesFile
    ? '\nThe rules file contains TODO placeholders — edit context/rules/ to complete Gold.'
    : '';
  if (todos) p.log.warning(todos);

  displayTierScore(ctx.tierScore);

  return { skipped: false, summary: `${ctx.tierScore.tier.toUpperCase()} (may need curation)` };
}
