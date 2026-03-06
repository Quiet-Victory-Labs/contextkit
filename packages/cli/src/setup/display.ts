import * as p from '@clack/prompts';
import type { TierScore } from '@runcontext/core';
import { formatTierScore } from '../formatters/pretty.js';

export function displayTierScore(score: TierScore): void {
  p.note(formatTierScore(score), 'Tier Scorecard');
}
