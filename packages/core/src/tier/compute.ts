import type { ContextGraph, TierScore, MetadataTier } from '../types/index.js';
import { checkBronze, checkSilver, checkGold } from './checks.js';

/**
 * Compute the tier score for a single model.
 *
 * The tier is determined hierarchically:
 * - Gold: all Bronze + Silver + Gold checks pass
 * - Silver: all Bronze + Silver checks pass
 * - Bronze: all Bronze checks pass
 * - None: some Bronze checks fail
 */
export function computeTier(modelName: string, graph: ContextGraph): TierScore {
  const bronzeChecks = checkBronze(modelName, graph);
  const silverChecks = checkSilver(modelName, graph);
  const goldChecks = checkGold(modelName, graph);

  const bronzePassed = bronzeChecks.every((c) => c.passed);
  const silverPassed = silverChecks.every((c) => c.passed);
  const goldPassed = goldChecks.every((c) => c.passed);

  let tier: MetadataTier;
  if (bronzePassed && silverPassed && goldPassed) {
    tier = 'gold';
  } else if (bronzePassed && silverPassed) {
    tier = 'silver';
  } else if (bronzePassed) {
    tier = 'bronze';
  } else {
    tier = 'none';
  }

  return {
    model: modelName,
    tier,
    bronze: { passed: bronzePassed, checks: bronzeChecks },
    silver: { passed: silverPassed, checks: silverChecks },
    gold: { passed: goldPassed, checks: goldChecks },
  };
}

/**
 * Compute tiers for every model in the graph and populate `graph.tiers`.
 */
export function computeAllTiers(graph: ContextGraph): void {
  for (const modelName of graph.models.keys()) {
    const score = computeTier(modelName, graph);
    graph.tiers.set(modelName, score);
  }
}
