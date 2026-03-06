import * as p from '@clack/prompts';
import path from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import type { SetupContext, StepResult } from '../types.js';

function buildProjectClaudeMd(ctx: SetupContext): string {
  const modelName = ctx.modelName;
  const tableList = ctx.tables.map((t) => t.name).join(', ');

  const intentBlock = ctx.intent
    ? `## What We're Building

${ctx.intent.goals}
${ctx.intent.metrics ? `\n**Key metrics:** ${ctx.intent.metrics}` : ''}
${ctx.intent.audience ? `\n**Audience:** ${ctx.intent.audience}` : ''}
`
    : '';

  return `# Project Instructions

This project uses **ContextKit** for metadata governance. The semantic layer lives in \`context/\` as YAML files.

${intentBlock}## ContextKit Quick Reference

| Command | What it does |
|---------|-------------|
| \`context tier\` | Show Bronze/Silver/Gold scorecard |
| \`context lint\` | Run all lint rules |
| \`context fix --write\` | Auto-fix lint issues |
| \`context verify\` | Validate metadata against live database |
| \`context enrich --target silver --apply\` | Auto-enrich to Silver |
| \`context build\` | Compile context files to manifest |
| \`context serve --stdio\` | Start MCP server for AI agents |
| \`context explain ${modelName}\` | Show full model details |

## Metadata Curation

Read \`context/AGENT_INSTRUCTIONS.md\` for detailed curation guidelines before editing any metadata files.

**Key rules:**
- Never fabricate metadata — query the database first
- Never invent owner names, emails, or contact info
- Test every golden query against the live database before writing it
- Run \`context tier\` after every change to track progress

## Data

Model: **${modelName}** | Tables: ${tableList}
Database: ${ctx.dsConfig.adapter} (${ctx.dsConfig.path ?? ctx.dsConfig.connection ?? 'configured'})

## File Structure

\`\`\`
context/
  models/*.osi.yaml          # OSI semantic model (schema, relationships, metrics)
  governance/*.governance.yaml  # Ownership, trust, security, semantic roles
  rules/*.rules.yaml         # Golden queries, business rules, guardrails
  lineage/*.lineage.yaml     # Upstream sources
  glossary/*.term.yaml       # Business term definitions
  owners/*.owner.yaml        # Team ownership records
  AGENT_INSTRUCTIONS.md      # Detailed curation guide for AI agents
\`\`\`
`;
}

export async function runProjectClaudeMdStep(ctx: SetupContext): Promise<StepResult> {
  const claudeDir = path.join(ctx.cwd, '.claude');
  const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');

  if (existsSync(claudeMdPath)) {
    const shouldOverwrite = await p.confirm({
      message: '.claude/CLAUDE.md already exists. Overwrite?',
    });
    if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
      return { skipped: true, summary: '.claude/CLAUDE.md kept existing' };
    }
  }

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  const content = buildProjectClaudeMd(ctx);
  writeFileSync(claudeMdPath, content, 'utf-8');

  p.log.success('Generated .claude/CLAUDE.md for AI-assisted curation');

  return { skipped: false, summary: 'Generated .claude/CLAUDE.md' };
}
