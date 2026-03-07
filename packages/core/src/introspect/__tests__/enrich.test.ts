import { describe, it, expect } from 'vitest';
import { suggestEnrichments } from '../enrich.js';
import type { TierScore } from '../../types/tier.js';

describe('suggestEnrichments', () => {
  it('suggests trust, tags, lineage for silver target', () => {
    const tierScore: TierScore = {
      tier: 'bronze',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: {
        passed: false,
        checks: [
          { id: 'silver/trust-status', label: 'Trust status is set', passed: false },
          { id: 'silver/min-tags', label: 'At least 2 tags', passed: false },
          { id: 'silver/glossary-linked', label: 'Glossary term linked', passed: false },
          { id: 'silver/upstream-lineage', label: 'Upstream lineage exists', passed: false },
          { id: 'silver/dataset-refresh', label: 'All datasets have refresh cadence', passed: false },
          { id: 'silver/sample-values', label: 'At least 2 fields have sample_values', passed: false },
        ],
      },
      gold: { passed: false, checks: [] },
    };
    const suggestions = suggestEnrichments('silver', tierScore, ['users', 'orders']);
    expect(suggestions.governance).toBeDefined();
    expect(suggestions.governance!.trust).toBe('endorsed');
    expect(suggestions.governance!.tags?.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.lineage).toBeDefined();
    expect(suggestions.lineage!.upstream?.length).toBeGreaterThanOrEqual(1);
  });

  it('suggests semantic_roles and rules for gold target', () => {
    const tierScore: TierScore = {
      tier: 'silver',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: { passed: true, checks: [] },
      gold: {
        passed: false,
        checks: [
          { id: 'gold/field-semantic-role', label: 'Every field has semantic_role', passed: false },
          { id: 'gold/golden-queries', label: 'At least 3 golden_queries exist', passed: false },
          { id: 'gold/guardrail-filter', label: 'At least 1 guardrail_filter exists', passed: false },
          { id: 'gold/business-rule', label: 'At least 1 business_rule exists', passed: false },
          { id: 'gold/hierarchy', label: 'At least 1 hierarchy exists', passed: false },
        ],
      },
    };
    const suggestions = suggestEnrichments('gold', tierScore, ['users']);
    expect(suggestions.needsRulesFile).toBe(true);
  });

  it('returns empty suggestions when already at target', () => {
    const tierScore: TierScore = {
      tier: 'gold',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: { passed: true, checks: [] },
      gold: { passed: true, checks: [] },
    };
    const suggestions = suggestEnrichments('gold', tierScore, []);
    expect(suggestions.governance).toBeUndefined();
    expect(suggestions.lineage).toBeUndefined();
  });

  it('suggests refresh cadence when missing', () => {
    const tierScore: TierScore = {
      tier: 'bronze',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: {
        passed: false,
        checks: [
          { id: 'silver/dataset-refresh', label: 'All datasets have refresh cadence', passed: false },
        ],
      },
      gold: { passed: false, checks: [] },
    };
    const suggestions = suggestEnrichments('silver', tierScore, ['users']);
    expect(suggestions.governance).toBeDefined();
    expect(suggestions.governance!.refreshAll).toBe('daily');
  });

  it('suggests sample values when missing', () => {
    const tierScore: TierScore = {
      tier: 'bronze',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: {
        passed: false,
        checks: [
          { id: 'silver/sample-values', label: 'At least 2 fields have sample_values', passed: false },
        ],
      },
      gold: { passed: false, checks: [] },
    };
    const suggestions = suggestEnrichments('silver', tierScore, ['users']);
    expect(suggestions.needsSampleValues).toBe(true);
  });

  it('suggests semantic roles when missing for gold', () => {
    const tierScore: TierScore = {
      tier: 'silver',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: { passed: true, checks: [] },
      gold: {
        passed: false,
        checks: [
          { id: 'gold/field-semantic-role', label: 'Every field has semantic_role', passed: false },
        ],
      },
    };
    const suggestions = suggestEnrichments('gold', tierScore, ['users']);
    expect(suggestions.needsSemanticRoles).toBe(true);
  });

  it('suggests glossary terms when glossary not linked', () => {
    const tierScore: TierScore = {
      tier: 'bronze',
      model: 'test',
      bronze: { passed: true, checks: [] },
      silver: {
        passed: false,
        checks: [
          { id: 'silver/glossary-linked', label: 'Glossary term linked', passed: false },
        ],
      },
      gold: { passed: false, checks: [] },
    };
    const suggestions = suggestEnrichments('silver', tierScore, ['users']);
    expect(suggestions.glossaryTerms).toBeDefined();
    expect(suggestions.glossaryTerms!.length).toBeGreaterThanOrEqual(1);
    expect(suggestions.glossaryTerms![0]!.id).toBe('users');
    expect(suggestions.glossaryTerms![0]!.owner).toBe('default-team');
  });
});
