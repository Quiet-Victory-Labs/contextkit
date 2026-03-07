import * as p from '@clack/prompts';
import path from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { scaffoldFromSchema, compile, computeTier, loadConfig } from '@runcontext/core';
import type { SetupContext, StepResult } from '../types.js';
import { displayTierScore } from '../display.js';

export async function runScaffoldStep(ctx: SetupContext): Promise<StepResult> {
  const shouldRun = await p.confirm({
    message: 'Scaffold Bronze metadata from database schema?',
  });
  if (p.isCancel(shouldRun) || !shouldRun) {
    return { skipped: true, summary: 'Skipped' };
  }

  const spin = p.spinner();
  spin.start('Scaffolding Bronze metadata...');

  const result = scaffoldFromSchema({
    modelName: ctx.modelName,
    dataSourceName: 'default',
    tables: ctx.tables,
    columns: ctx.columns,
  });

  // Create directories
  for (const dir of ['models', 'governance', 'owners', 'reference']) {
    const dirPath = path.join(ctx.contextDir, dir);
    if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
  }

  // Create reference README if it doesn't exist
  const refReadme = path.join(ctx.contextDir, 'reference', 'README.md');
  if (!existsSync(refReadme)) {
    writeFileSync(refReadme, `# Reference Documents

Drop files here that help describe your data — the AI agent will read them when curating metadata.

Examples of useful reference documents:
- Data dictionaries (CSV, Excel, PDF)
- Confluence or wiki exports
- ERD diagrams or schema docs
- Business glossaries from your organization
- Dashboard screenshots or descriptions
- Data pipeline documentation
- Slack/email threads explaining metric definitions

The agent will use these as context when writing descriptions, defining metrics,
creating glossary terms, and building business context. The more context you
provide, the better the metadata quality.

Supported formats: .md, .txt, .csv, .json, .yaml, .pdf
`, 'utf-8');
  }

  // Write files
  const created: string[] = [];
  const files = [
    { rel: path.join('models', result.files.osi), content: result.osiYaml },
    { rel: path.join('governance', result.files.governance), content: result.governanceYaml },
    { rel: path.join('owners', result.files.owner), content: result.ownerYaml },
  ];

  for (const f of files) {
    const fullPath = path.join(ctx.contextDir, f.rel);
    writeFileSync(fullPath, f.content, 'utf-8');
    created.push(f.rel);
  }

  // Recompile and compute tier
  const config = loadConfig(ctx.cwd);
  const { graph } = await compile({ contextDir: ctx.contextDir, config, rootDir: ctx.cwd });
  ctx.graph = graph;
  ctx.tierScore = computeTier(ctx.modelName, graph);

  spin.stop(`Created ${created.length} files`);

  const fileList = created.map((f) => `  ${f}`).join('\n');
  p.note(fileList, 'Files Created');
  displayTierScore(ctx.tierScore);

  return { skipped: false, summary: `${created.length} files → ${ctx.tierScore.tier.toUpperCase()}` };
}
