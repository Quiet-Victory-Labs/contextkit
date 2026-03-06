import * as p from '@clack/prompts';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import * as yaml from 'yaml';
import {
  compile,
  computeTier,
  suggestEnrichments,
  loadConfig,
  createAdapter,
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

export async function runEnrichSilverStep(ctx: SetupContext): Promise<StepResult> {
  // Recompile to get fresh state
  const config = loadConfig(ctx.cwd);
  const { graph } = await compile({ contextDir: ctx.contextDir, config, rootDir: ctx.cwd });
  ctx.graph = graph;
  const tierScore = computeTier(ctx.modelName, graph);

  if (tierScore.silver.passed) {
    p.log.success('Already at Silver or above — skipping.');
    ctx.tierScore = tierScore;
    return { skipped: true, summary: 'Already Silver' };
  }

  const model = graph.models.get(ctx.modelName);
  if (!model) {
    p.log.error(`Model "${ctx.modelName}" not found in graph.`);
    return { skipped: true, summary: 'Model not found' };
  }

  const datasetNames = model.datasets.map((d) => d.name);
  const suggestions = suggestEnrichments('silver', tierScore, datasetNames);

  // Build preview of what will be added
  const preview: string[] = [];
  if (suggestions.governance?.trust) preview.push(`+ trust: ${suggestions.governance.trust}`);
  if (suggestions.governance?.tags) preview.push(`+ tags: [${suggestions.governance.tags.join(', ')}]`);
  if (suggestions.governance?.refreshAll) preview.push(`+ refresh: ${suggestions.governance.refreshAll} (all datasets)`);
  if (suggestions.lineage) preview.push(`+ ${suggestions.lineage.upstream?.length ?? 0} lineage upstream source(s)`);
  if (suggestions.glossaryTerms) preview.push(`+ ${suggestions.glossaryTerms.length} glossary term(s)`);
  if (suggestions.needsSampleValues) preview.push('+ sample_values from live data');

  if (preview.length > 0) {
    p.note(preview.join('\n'), 'Silver Enrichments');
  }

  const shouldRun = await p.confirm({
    message: 'Apply Silver enrichments?',
  });
  if (p.isCancel(shouldRun) || !shouldRun) {
    return { skipped: true, summary: 'Skipped' };
  }

  const spin = p.spinner();
  spin.start('Enriching to Silver...');

  // Apply governance changes
  const govFilePath = findFileRecursive(ctx.contextDir, `${ctx.modelName}.governance.yaml`);
  if (govFilePath) {
    const govContent = readFileSync(govFilePath, 'utf-8');
    const govDoc = yaml.parse(govContent) ?? {};

    if (suggestions.governance?.trust) govDoc.trust = suggestions.governance.trust;
    if (suggestions.governance?.tags) govDoc.tags = suggestions.governance.tags;
    if (suggestions.governance?.refreshAll) {
      for (const dsName of Object.keys(govDoc.datasets ?? {})) {
        govDoc.datasets[dsName].refresh = suggestions.governance.refreshAll;
      }
    }

    // Populate sample values from DB
    if (suggestions.needsSampleValues) {
      govDoc.fields = govDoc.fields ?? {};
      try {
        let count = 0;
        for (const ds of model.datasets) {
          if (count >= 2) break;
          const tableName = ds.source?.split('.').pop() ?? ds.name;
          for (const field of ds.fields ?? []) {
            if (count >= 2) break;
            const fieldKey = `${ds.name}.${field.name}`;
            if (govDoc.fields[fieldKey]?.sample_values?.length > 0) continue;
            try {
              const result = await ctx.adapter.query(
                `SELECT DISTINCT CAST("${field.name}" AS VARCHAR) AS val FROM "${tableName}" WHERE "${field.name}" IS NOT NULL LIMIT 5`,
              );
              if (result.rows.length > 0) {
                govDoc.fields[fieldKey] = govDoc.fields[fieldKey] ?? {};
                govDoc.fields[fieldKey].sample_values = result.rows.map((r: any) => String(r.val));
                count++;
              }
            } catch {
              // skip fields that can't be queried
            }
          }
        }
      } catch {
        // adapter query failed — skip sample values
      }
    }

    writeFileSync(govFilePath, yaml.stringify(govDoc, { lineWidth: 120 }), 'utf-8');
  }

  // Write lineage file
  if (suggestions.lineage) {
    const lineageDir = path.join(ctx.contextDir, 'lineage');
    if (!existsSync(lineageDir)) mkdirSync(lineageDir, { recursive: true });
    const lineagePath = path.join(lineageDir, `${ctx.modelName}.lineage.yaml`);
    if (!existsSync(lineagePath)) {
      const lineageDoc = { model: ctx.modelName, upstream: suggestions.lineage.upstream };
      writeFileSync(lineagePath, yaml.stringify(lineageDoc, { lineWidth: 120 }), 'utf-8');
    }
  }

  // Write glossary terms
  if (suggestions.glossaryTerms) {
    const glossaryDir = path.join(ctx.contextDir, 'glossary');
    if (!existsSync(glossaryDir)) mkdirSync(glossaryDir, { recursive: true });
    for (const term of suggestions.glossaryTerms) {
      const termPath = path.join(glossaryDir, `${term.id}.term.yaml`);
      if (!existsSync(termPath)) {
        writeFileSync(termPath, yaml.stringify(term, { lineWidth: 120 }), 'utf-8');
      }
    }
  }

  // Recompile and score
  const { graph: newGraph } = await compile({ contextDir: ctx.contextDir, config, rootDir: ctx.cwd });
  ctx.graph = newGraph;
  ctx.tierScore = computeTier(ctx.modelName, newGraph);

  spin.stop('Applied Silver enrichments');
  displayTierScore(ctx.tierScore);

  return { skipped: false, summary: ctx.tierScore.tier.toUpperCase() };
}
