import type { TierScore, MetadataTier } from '../types/tier.js';

export interface EnrichResult {
  governance?: {
    trust?: string;
    tags?: string[];
    refreshAll?: string;
  };
  lineage?: {
    upstream?: Array<{ source: string; type: string; notes: string }>;
  };
  glossaryTerms?: Array<{ id: string; definition: string; owner: string }>;
  needsRulesFile?: boolean;
  needsSampleValues?: boolean;
  needsSemanticRoles?: boolean;
}

const TIER_ORDER: MetadataTier[] = ['none', 'bronze', 'silver', 'gold'];

/**
 * Analyze a tier score and suggest enrichments needed to reach the target tier.
 *
 * Examines failed checks at each tier level between current and target,
 * then produces concrete suggestions for what metadata to add.
 */
export function suggestEnrichments(
  target: MetadataTier,
  tierScore: TierScore,
  datasetNames: string[],
): EnrichResult {
  const currentIdx = TIER_ORDER.indexOf(tierScore.tier);
  const targetIdx = TIER_ORDER.indexOf(target);

  if (currentIdx >= targetIdx) return {};

  const result: EnrichResult = {};

  // Silver suggestions: trust, tags, glossary, lineage, refresh, sample_values
  if (targetIdx >= TIER_ORDER.indexOf('silver') && !tierScore.silver.passed) {
    const failedLabels = tierScore.silver.checks
      .filter((c) => !c.passed)
      .map((c) => c.label);

    if (failedLabels.some((label) => label.includes('Trust'))) {
      result.governance = result.governance ?? {};
      result.governance.trust = 'endorsed';
    }

    if (failedLabels.some((label) => label.includes('tags'))) {
      result.governance = result.governance ?? {};
      result.governance.tags = datasetNames.length > 0
        ? [datasetNames[0].replace(/_/g, '-'), 'analytics']
        : ['analytics', 'data'];
    }

    if (failedLabels.some((label) => label.includes('lineage'))) {
      result.lineage = {
        upstream: datasetNames.map((ds) => ({
          source: ds,
          type: 'pipeline',
          notes: `Upstream source for ${ds}`,
        })),
      };
    }

    if (failedLabels.some((label) => label.includes('refresh'))) {
      result.governance = result.governance ?? {};
      result.governance.refreshAll = 'daily';
    }

    if (failedLabels.some((label) => label.includes('Glossary'))) {
      result.glossaryTerms = [{
        id: datasetNames[0]?.replace(/_/g, '-') ?? 'term',
        definition: `Definition for ${datasetNames[0] ?? 'entity'}`,
        owner: 'default-team',
      }];
    }

    if (failedLabels.some((label) => label.includes('sample_values'))) {
      result.needsSampleValues = true;
    }
  }

  // Gold suggestions: semantic_role, rules file (golden_queries, guardrails, business_rules, hierarchies)
  if (targetIdx >= TIER_ORDER.indexOf('gold') && !tierScore.gold.passed) {
    const failedLabels = tierScore.gold.checks
      .filter((c) => !c.passed)
      .map((c) => c.label);

    if (failedLabels.some((label) => label.includes('semantic_role'))) {
      result.needsSemanticRoles = true;
    }

    if (failedLabels.some((label) =>
      label.includes('golden_queries') || label.includes('guardrail') ||
      label.includes('business_rule') || label.includes('hierarch'),
    )) {
      result.needsRulesFile = true;
    }
  }

  return result;
}
