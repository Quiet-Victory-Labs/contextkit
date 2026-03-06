import { Command } from 'commander';
import chalk from 'chalk';
import { ALL_RULES, type LintRule, type RuleTier } from '@runcontext/core';
import { formatJson } from '../formatters/json.js';

function formatRuleTable(rules: LintRule[]): string {
  if (rules.length === 0) {
    return chalk.gray('No rules match the filters.');
  }

  const lines: string[] = [];

  // Header
  const header = `${'ID'.padEnd(40)} ${'Tier'.padEnd(8)} ${'Severity'.padEnd(10)} ${'Fix'.padEnd(5)} Description`;
  lines.push(chalk.bold(header));
  lines.push(chalk.gray('─'.repeat(100)));

  for (const rule of rules) {
    const tier = rule.tier ?? '—';
    const tierCol = colorTier(tier);
    const fixCol = rule.fixable ? chalk.green('yes') : chalk.gray('no');
    const sevCol =
      rule.defaultSeverity === 'error'
        ? chalk.red(rule.defaultSeverity)
        : chalk.yellow(rule.defaultSeverity);
    const deprecated = rule.deprecated ? chalk.gray(' (deprecated)') : '';

    lines.push(
      `${rule.id.padEnd(40)} ${tierCol.padEnd(8 + (tierCol.length - tier.length))} ${sevCol.padEnd(10 + (sevCol.length - rule.defaultSeverity.length))} ${fixCol.padEnd(5 + (fixCol.length - (rule.fixable ? 3 : 2)))} ${rule.description}${deprecated}`,
    );
  }

  lines.push('');
  lines.push(chalk.gray(`${rules.length} rule(s) total`));

  return lines.join('\n');
}

function colorTier(tier: string): string {
  switch (tier) {
    case 'gold':
      return chalk.yellow(tier);
    case 'silver':
      return chalk.white(tier);
    case 'bronze':
      return chalk.hex('#CD7F32')(tier);
    default:
      return chalk.gray(tier);
  }
}

export const rulesCommand = new Command('rules')
  .description('List all lint rules with metadata')
  .option('--tier <tier>', 'Filter by tier: bronze, silver, gold')
  .option('--fixable', 'Show only fixable rules')
  .option('--format <type>', 'Output format: pretty or json', 'pretty')
  .action((opts) => {
    let rules = [...ALL_RULES];

    // Filter by tier
    if (opts.tier) {
      const tier = opts.tier as RuleTier;
      rules = rules.filter((r) => r.tier === tier);
    }

    // Filter by fixable
    if (opts.fixable) {
      rules = rules.filter((r) => r.fixable);
    }

    if (opts.format === 'json') {
      const data = rules.map((r) => ({
        id: r.id,
        tier: r.tier ?? null,
        defaultSeverity: r.defaultSeverity,
        fixable: r.fixable,
        description: r.description,
        deprecated: r.deprecated ?? false,
        replacedBy: r.replacedBy ?? null,
      }));
      console.log(formatJson(data));
    } else {
      console.log(formatRuleTable(rules));
    }
  });
