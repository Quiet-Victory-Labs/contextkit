import { Command } from 'commander';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { runConnectStep } from '../setup/steps/connect.js';
import { runScaffoldStep } from '../setup/steps/scaffold.js';
import { runEnrichSilverStep } from '../setup/steps/enrich-silver.js';
import { runEnrichGoldStep } from '../setup/steps/enrich-gold.js';
import { runVerifyStep } from '../setup/steps/verify.js';
import { runAutofixStep } from '../setup/steps/autofix.js';
import { runAgentInstructionsStep } from '../setup/steps/claude-md.js';
import { displayTierScore } from '../setup/display.js';

export const setupCommand = new Command('setup')
  .description('Interactive wizard — detects databases, introspects schema, scaffolds metadata, enriches to Silver, generates agent instructions. Supports DuckDB, PostgreSQL, MySQL, SQL Server, SQLite, Snowflake, BigQuery, ClickHouse, and Databricks.')
  .action(async () => {
    p.intro(chalk.bgCyan(chalk.black(' ContextKit Setup ')));

    const ctx = await runConnectStep();
    if (!ctx) return;

    try {
      // Build step list based on target tier
      const steps: Array<{ name: string; fn: (ctx: any) => Promise<any> }> = [
        { name: 'Scaffold Bronze', fn: runScaffoldStep },
      ];

      if (ctx.targetTier === 'silver' || ctx.targetTier === 'gold') {
        steps.push({ name: 'Enrich to Silver', fn: runEnrichSilverStep });
      }
      if (ctx.targetTier === 'gold') {
        steps.push({ name: 'Enrich to Gold', fn: runEnrichGoldStep });
      }

      steps.push(
        { name: 'Verify data', fn: runVerifyStep },
        { name: 'Auto-fix', fn: runAutofixStep },
        { name: 'Generate agent instructions', fn: runAgentInstructionsStep },
      );

      // Run each step
      const results: Array<{ name: string; summary: string }> = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        p.log.step(`${chalk.dim(`[${i + 1}/${steps.length}]`)} ${step.name}`);
        const result = await step.fn(ctx);
        results.push({ name: step.name, summary: result.summary });
      }

      // Final summary
      const summaryLines = results
        .map((r) => `  ${chalk.green('+')} ${r.name}: ${r.summary}`)
        .join('\n');
      p.note(summaryLines, 'Summary');

      if (ctx.tierScore) {
        displayTierScore(ctx.tierScore);
      }

      // Show next steps based on current tier vs target
      const currentTier = ctx.tierScore?.tier ?? 'none';
      const reachedTarget =
        (ctx.targetTier === 'bronze' && ['bronze', 'silver', 'gold'].includes(currentTier)) ||
        (ctx.targetTier === 'silver' && ['silver', 'gold'].includes(currentTier)) ||
        (ctx.targetTier === 'gold' && currentTier === 'gold');

      if (reachedTarget) {
        p.outro(`Done! You're at ${chalk.bold(currentTier.toUpperCase())}. Run ${chalk.cyan('context tier')} anytime to check.`);
      } else if (ctx.targetTier === 'gold' && currentTier !== 'gold') {
        // Gold needs AI curation — show the handoff
        const nextSteps = [
          `Your metadata is at ${chalk.bold(currentTier.toUpperCase())} — Gold needs human curation.`,
          '',
          `${chalk.bold('If you\'re an AI agent:')}`,
          `  Read ${chalk.cyan('context/AGENT_INSTRUCTIONS.md')} for the full curation guide.`,
          `  Run ${chalk.cyan('context tier')} → pick a failing check → query the database → fix it → repeat.`,
          `  Ask the user about ownership, metric intent, and business rules as you go.`,
          '',
          `${chalk.bold('If you\'re a human:')}`,
          `  Tell your AI agent: "Read context/AGENT_INSTRUCTIONS.md and get this project to Gold."`,
          `  The agent will go back and forth with you, asking about your data as it builds.`,
          `  Or use ${chalk.cyan('context dev --studio')} to edit metadata visually in the browser.`,
        ];
        p.note(nextSteps.join('\n'), 'Next Steps');
        p.outro(`Run ${chalk.cyan('context tier')} to check your scorecard.`);
      } else {
        p.outro(`Run ${chalk.cyan('context tier')} to check your scorecard.`);
      }
    } finally {
      try {
        await ctx.adapter.disconnect();
      } catch {
        // ignore disconnect errors
      }
    }
  });
