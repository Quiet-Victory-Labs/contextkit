import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../graph/builder.js';
import type {
  Concept,
  Product,
  Entity,
  Owner,
  Term,
  Policy,
} from '../../types/index.js';

import { referencesResolvable } from '../rules/references-resolvable.js';
import { glossaryNoDuplicateTerms } from '../rules/glossary-no-duplicate-terms.js';
import { conceptsCertifiedRequiresEvidence } from '../rules/concepts-certified-requires-evidence.js';
import { policiesUnknownSubject } from '../rules/policies-unknown-subject.js';
import { policiesDenyOverridesAllow } from '../rules/policies-deny-overrides-allow.js';
import { docsExamplesRequired } from '../rules/docs-examples-required.js';
import { deprecationRequireSunset } from '../rules/deprecation-require-sunset.js';
import { packagingNoSecrets } from '../rules/packaging-no-secrets.js';
import { ALL_RULES } from '../rules/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOwner(overrides: Partial<Owner> = {}): Owner {
  return {
    id: 'finance-team',
    kind: 'owner',
    displayName: 'Finance Team',
    source: { file: 'owners/finance-team.owner.yaml', line: 1, col: 1 },
    ...overrides,
  };
}

function makeConcept(overrides: Partial<Concept> = {}): Concept {
  return {
    id: 'gross-revenue',
    kind: 'concept',
    definition: 'Total invoiced revenue before refunds.',
    owner: 'finance-team',
    source: { file: 'concepts/gross-revenue.ctx.yaml', line: 1, col: 1 },
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'revenue-reporting',
    kind: 'product',
    description: 'Official revenue reporting.',
    owner: 'finance-team',
    source: { file: 'products/revenue-reporting.ctx.yaml', line: 1, col: 1 },
    ...overrides,
  };
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'customer',
    kind: 'entity',
    owner: 'finance-team',
    definition: 'A paying customer.',
    source: { file: 'entities/customer.ctx.yaml', line: 1, col: 1 },
    ...overrides,
  };
}

function makeTerm(overrides: Partial<Term> = {}): Term {
  return {
    id: 'arr',
    kind: 'term',
    definition: 'Annual Recurring Revenue.',
    source: { file: 'terms/arr.ctx.yaml', line: 1, col: 1 },
    ...overrides,
  };
}

function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: 'data-access',
    kind: 'policy',
    description: 'Data access policy.',
    rules: [{ priority: 1, when: {}, then: { deny: false } }],
    source: { file: 'policies/data-access.ctx.yaml', line: 1, col: 1 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — references/resolvable
// ---------------------------------------------------------------------------

describe('references/resolvable', () => {
  it('has correct metadata', () => {
    expect(referencesResolvable.id).toBe('references/resolvable');
    expect(referencesResolvable.defaultSeverity).toBe('error');
    expect(referencesResolvable.fixable).toBe(false);
  });

  it('passes when all references resolve', () => {
    const graph = buildGraph([
      makeOwner(),
      makeProduct(),
      makeConcept({
        owner: 'finance-team',
        dependsOn: ['revenue-reporting'],
        productId: 'revenue-reporting',
      }),
      makeTerm({ mapsTo: ['gross-revenue'] }),
    ]);
    expect(referencesResolvable.run(graph)).toEqual([]);
  });

  it('flags unresolved owner reference', () => {
    const graph = buildGraph([
      makeConcept({ owner: 'nonexistent-team' }),
    ]);
    const diags = referencesResolvable.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('nonexistent-team');
    expect(diags[0].ruleId).toBe('references/resolvable');
  });

  it('flags unresolved dependsOn reference', () => {
    const graph = buildGraph([
      makeOwner(),
      makeConcept({ dependsOn: ['nonexistent-concept'] }),
    ]);
    const diags = referencesResolvable.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('nonexistent-concept');
  });

  it('flags unresolved productId reference', () => {
    const graph = buildGraph([
      makeOwner(),
      makeConcept({ productId: 'nonexistent-product' }),
    ]);
    const diags = referencesResolvable.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('nonexistent-product');
  });

  it('flags unresolved mapsTo reference in terms', () => {
    const graph = buildGraph([
      makeTerm({ mapsTo: ['nonexistent-concept'] }),
    ]);
    const diags = referencesResolvable.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('nonexistent-concept');
  });

  it('emits multiple diagnostics for multiple broken references', () => {
    const graph = buildGraph([
      makeConcept({
        owner: 'ghost-owner',
        dependsOn: ['ghost-a', 'ghost-b'],
        productId: 'ghost-product',
      }),
    ]);
    const diags = referencesResolvable.run(graph);
    // owner + 2 dependsOn + productId = 4
    expect(diags).toHaveLength(4);
  });

  it('does not flag policies or owners', () => {
    const graph = buildGraph([
      makePolicy({ owner: 'ghost-owner' }),
      makeOwner(),
    ]);
    const diags = referencesResolvable.run(graph);
    expect(diags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests — glossary/no-duplicate-terms
// ---------------------------------------------------------------------------

describe('glossary/no-duplicate-terms', () => {
  it('has correct metadata', () => {
    expect(glossaryNoDuplicateTerms.id).toBe('glossary/no-duplicate-terms');
    expect(glossaryNoDuplicateTerms.defaultSeverity).toBe('warning');
    expect(glossaryNoDuplicateTerms.fixable).toBe(false);
  });

  it('passes when all term definitions are unique', () => {
    const graph = buildGraph([
      makeTerm({ id: 'arr', definition: 'Annual Recurring Revenue.' }),
      makeTerm({ id: 'mrr', definition: 'Monthly Recurring Revenue.' }),
    ]);
    expect(glossaryNoDuplicateTerms.run(graph)).toEqual([]);
  });

  it('flags terms with identical definitions (case-insensitive)', () => {
    const graph = buildGraph([
      makeTerm({ id: 'arr', definition: 'Annual Recurring Revenue.' }),
      makeTerm({
        id: 'annual-revenue',
        definition: 'annual recurring revenue.',
        source: { file: 'terms/annual-revenue.ctx.yaml', line: 1, col: 1 },
      }),
    ]);
    const diags = glossaryNoDuplicateTerms.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('annual-revenue');
    expect(diags[0].message).toContain('arr');
  });

  it('flags the second occurrence, not the first', () => {
    const graph = buildGraph([
      makeTerm({
        id: 'arr',
        definition: 'Same definition.',
        source: { file: 'terms/arr.ctx.yaml', line: 1, col: 1 },
      }),
      makeTerm({
        id: 'arr-dupe',
        definition: 'Same definition.',
        source: { file: 'terms/arr-dupe.ctx.yaml', line: 5, col: 1 },
      }),
    ]);
    const diags = glossaryNoDuplicateTerms.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].source.file).toBe('terms/arr-dupe.ctx.yaml');
  });

  it('ignores non-term nodes', () => {
    const graph = buildGraph([
      makeConcept({ definition: 'Same definition.' }),
      makeTerm({ definition: 'Same definition.' }),
    ]);
    // Only 1 term, so no duplicates
    expect(glossaryNoDuplicateTerms.run(graph)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests — concepts/certified-requires-evidence
// ---------------------------------------------------------------------------

describe('concepts/certified-requires-evidence', () => {
  it('has correct metadata', () => {
    expect(conceptsCertifiedRequiresEvidence.id).toBe('concepts/certified-requires-evidence');
    expect(conceptsCertifiedRequiresEvidence.defaultSeverity).toBe('error');
    expect(conceptsCertifiedRequiresEvidence.fixable).toBe(false);
  });

  it('passes for certified concept with evidence', () => {
    const graph = buildGraph([
      makeConcept({
        certified: true,
        evidence: [{ type: 'doc', ref: 'https://example.com/spec' }],
      }),
    ]);
    expect(conceptsCertifiedRequiresEvidence.run(graph)).toEqual([]);
  });

  it('passes for non-certified concept without evidence', () => {
    const graph = buildGraph([
      makeConcept({ certified: false }),
    ]);
    expect(conceptsCertifiedRequiresEvidence.run(graph)).toEqual([]);
  });

  it('passes when certified is undefined', () => {
    const graph = buildGraph([
      makeConcept(),
    ]);
    expect(conceptsCertifiedRequiresEvidence.run(graph)).toEqual([]);
  });

  it('flags certified concept with no evidence', () => {
    const graph = buildGraph([
      makeConcept({ certified: true }),
    ]);
    const diags = conceptsCertifiedRequiresEvidence.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe('concepts/certified-requires-evidence');
    expect(diags[0].message).toContain('certified');
    expect(diags[0].message).toContain('no evidence');
  });

  it('flags certified concept with empty evidence array', () => {
    const graph = buildGraph([
      makeConcept({ certified: true, evidence: [] }),
    ]);
    const diags = conceptsCertifiedRequiresEvidence.run(graph);
    expect(diags).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — policies/unknown-subject
// ---------------------------------------------------------------------------

describe('policies/unknown-subject', () => {
  it('has correct metadata', () => {
    expect(policiesUnknownSubject.id).toBe('policies/unknown-subject');
    expect(policiesUnknownSubject.defaultSeverity).toBe('warning');
    expect(policiesUnknownSubject.fixable).toBe(false);
  });

  it('passes when all concept and tag references exist', () => {
    const graph = buildGraph([
      makeConcept({ id: 'gross-revenue', tags: ['finance'] }),
      makePolicy({
        rules: [
          { priority: 1, when: { conceptIds: ['gross-revenue'], tagsAny: ['finance'] }, then: {} },
        ],
      }),
    ]);
    expect(policiesUnknownSubject.run(graph)).toEqual([]);
  });

  it('flags unknown conceptIds', () => {
    const graph = buildGraph([
      makePolicy({
        rules: [
          { priority: 1, when: { conceptIds: ['nonexistent'] }, then: {} },
        ],
      }),
    ]);
    const diags = policiesUnknownSubject.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('nonexistent');
  });

  it('flags unknown tags', () => {
    const graph = buildGraph([
      makePolicy({
        rules: [
          { priority: 1, when: { tagsAny: ['nonexistent-tag'] }, then: {} },
        ],
      }),
    ]);
    const diags = policiesUnknownSubject.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('nonexistent-tag');
  });

  it('flags conceptIds referencing non-concept nodes', () => {
    const graph = buildGraph([
      makeProduct({ id: 'some-product' }),
      makePolicy({
        rules: [
          { priority: 1, when: { conceptIds: ['some-product'] }, then: {} },
        ],
      }),
    ]);
    const diags = policiesUnknownSubject.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('some-product');
  });

  it('emits multiple diagnostics for multiple unknown references', () => {
    const graph = buildGraph([
      makePolicy({
        rules: [
          { priority: 1, when: { conceptIds: ['ghost-a', 'ghost-b'], tagsAny: ['ghost-tag'] }, then: {} },
        ],
      }),
    ]);
    const diags = policiesUnknownSubject.run(graph);
    expect(diags).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Tests — policies/deny-overrides-allow
// ---------------------------------------------------------------------------

describe('policies/deny-overrides-allow', () => {
  it('has correct metadata', () => {
    expect(policiesDenyOverridesAllow.id).toBe('policies/deny-overrides-allow');
    expect(policiesDenyOverridesAllow.defaultSeverity).toBe('warning');
    expect(policiesDenyOverridesAllow.fixable).toBe(false);
  });

  it('passes when deny rules have higher priority than allow rules', () => {
    const graph = buildGraph([
      makePolicy({
        rules: [
          { priority: 1, when: {}, then: { requireRole: 'analyst' } },
          { priority: 10, when: {}, then: { deny: true } },
        ],
      }),
    ]);
    expect(policiesDenyOverridesAllow.run(graph)).toEqual([]);
  });

  it('passes when there are only allow rules (no deny)', () => {
    const graph = buildGraph([
      makePolicy({
        rules: [
          { priority: 1, when: {}, then: { requireRole: 'analyst' } },
          { priority: 5, when: {}, then: { requireRole: 'admin' } },
        ],
      }),
    ]);
    expect(policiesDenyOverridesAllow.run(graph)).toEqual([]);
  });

  it('passes when there are only deny rules', () => {
    const graph = buildGraph([
      makePolicy({
        rules: [
          { priority: 1, when: {}, then: { deny: true } },
          { priority: 5, when: {}, then: { deny: true } },
        ],
      }),
    ]);
    expect(policiesDenyOverridesAllow.run(graph)).toEqual([]);
  });

  it('flags deny rule with lower priority than allow rule', () => {
    const graph = buildGraph([
      makePolicy({
        rules: [
          { priority: 10, when: {}, then: { requireRole: 'analyst' } },
          { priority: 1, when: {}, then: { deny: true } },
        ],
      }),
    ]);
    const diags = policiesDenyOverridesAllow.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('deny');
    expect(diags[0].message).toContain('priority 1');
  });

  it('flags deny rule with equal priority to allow rule', () => {
    const graph = buildGraph([
      makePolicy({
        rules: [
          { priority: 5, when: {}, then: { requireRole: 'analyst' } },
          { priority: 5, when: {}, then: { deny: true } },
        ],
      }),
    ]);
    const diags = policiesDenyOverridesAllow.run(graph);
    expect(diags).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — docs/examples-required
// ---------------------------------------------------------------------------

describe('docs/examples-required', () => {
  it('has correct metadata', () => {
    expect(docsExamplesRequired.id).toBe('docs/examples-required');
    expect(docsExamplesRequired.defaultSeverity).toBe('warning');
    expect(docsExamplesRequired.fixable).toBe(false);
  });

  it('passes for certified concept with examples', () => {
    const graph = buildGraph([
      makeConcept({
        certified: true,
        examples: [{ label: 'Basic usage', content: 'Total before refunds', kind: 'do' }],
      }),
    ]);
    expect(docsExamplesRequired.run(graph)).toEqual([]);
  });

  it('passes for non-certified concept without examples', () => {
    const graph = buildGraph([
      makeConcept({ certified: false }),
    ]);
    expect(docsExamplesRequired.run(graph)).toEqual([]);
  });

  it('flags certified concept with no examples', () => {
    const graph = buildGraph([
      makeConcept({ certified: true }),
    ]);
    const diags = docsExamplesRequired.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe('docs/examples-required');
    expect(diags[0].message).toContain('no examples');
  });

  it('flags certified concept with empty examples array', () => {
    const graph = buildGraph([
      makeConcept({ certified: true, examples: [] }),
    ]);
    const diags = docsExamplesRequired.run(graph);
    expect(diags).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — deprecation/require-sunset
// ---------------------------------------------------------------------------

describe('deprecation/require-sunset', () => {
  it('has correct metadata', () => {
    expect(deprecationRequireSunset.id).toBe('deprecation/require-sunset');
    expect(deprecationRequireSunset.defaultSeverity).toBe('warning');
    expect(deprecationRequireSunset.fixable).toBe(false);
  });

  it('passes for deprecated node with sunset tag', () => {
    const graph = buildGraph([
      makeConcept({ status: 'deprecated', tags: ['sunset:2026-06-01'] }),
    ]);
    expect(deprecationRequireSunset.run(graph)).toEqual([]);
  });

  it('passes for non-deprecated nodes without sunset tag', () => {
    const graph = buildGraph([
      makeConcept({ status: 'draft' }),
      makeConcept({ id: 'certified-concept', status: 'certified' }),
    ]);
    expect(deprecationRequireSunset.run(graph)).toEqual([]);
  });

  it('passes for nodes with no status', () => {
    const graph = buildGraph([
      makeConcept(),
    ]);
    expect(deprecationRequireSunset.run(graph)).toEqual([]);
  });

  it('flags deprecated node without sunset tag', () => {
    const graph = buildGraph([
      makeConcept({ status: 'deprecated', tags: ['finance'] }),
    ]);
    const diags = deprecationRequireSunset.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe('deprecation/require-sunset');
    expect(diags[0].message).toContain('sunset');
  });

  it('flags deprecated node with no tags at all', () => {
    const graph = buildGraph([
      makeConcept({ status: 'deprecated', tags: undefined }),
    ]);
    const diags = deprecationRequireSunset.run(graph);
    expect(diags).toHaveLength(1);
  });

  it('works across different node kinds', () => {
    const graph = buildGraph([
      makeTerm({ status: 'deprecated' }),
      makeProduct({ id: 'old-product', status: 'deprecated' }),
    ]);
    const diags = deprecationRequireSunset.run(graph);
    expect(diags).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — packaging/no-secrets
// ---------------------------------------------------------------------------

describe('packaging/no-secrets', () => {
  it('has correct metadata', () => {
    expect(packagingNoSecrets.id).toBe('packaging/no-secrets');
    expect(packagingNoSecrets.defaultSeverity).toBe('error');
    expect(packagingNoSecrets.fixable).toBe(false);
  });

  it('passes for clean content', () => {
    const graph = buildGraph([
      makeConcept({ definition: 'Total invoiced revenue before refunds.' }),
      makeProduct({ description: 'Official revenue reporting dashboard.' }),
    ]);
    expect(packagingNoSecrets.run(graph)).toEqual([]);
  });

  it('flags AWS access key in definition', () => {
    const graph = buildGraph([
      makeConcept({ definition: 'Uses key AKIAIOSFODNN7EXAMPLE for access.' }),
    ]);
    const diags = packagingNoSecrets.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('AWS access key');
  });

  it('flags password pattern in description', () => {
    const graph = buildGraph([
      makeProduct({ description: 'Connect with password=hunter2 to access.' }),
    ]);
    const diags = packagingNoSecrets.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('password');
  });

  it('flags secret pattern in definition', () => {
    const graph = buildGraph([
      makeTerm({ definition: 'Set secret: my-super-secret-value to authenticate.' }),
    ]);
    const diags = packagingNoSecrets.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('secret');
  });

  it('flags token pattern in definition', () => {
    const graph = buildGraph([
      makeConcept({ definition: 'Use token=abc123def456 for auth.' }),
    ]);
    const diags = packagingNoSecrets.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('token');
  });

  it('flags secrets in example content', () => {
    const graph = buildGraph([
      makeConcept({
        examples: [
          { label: 'Bad example', content: 'password: supersecret123', kind: 'dont' },
        ],
      }),
    ]);
    const diags = packagingNoSecrets.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('example');
  });

  it('does not flag normal text that happens to contain common words', () => {
    const graph = buildGraph([
      makeConcept({ definition: 'This concept describes password requirements for users.' }),
    ]);
    // "password requirements" does not match "password\s*[:=]\s*\S+"
    expect(packagingNoSecrets.run(graph)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests — ALL_RULES array
// ---------------------------------------------------------------------------

describe('ALL_RULES', () => {
  it('contains exactly 12 rules (4 existing + 8 new)', () => {
    expect(ALL_RULES).toHaveLength(12);
  });

  it('has unique rule IDs', () => {
    const ids = ALL_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes all expected rule IDs', () => {
    const ids = new Set(ALL_RULES.map(r => r.id));
    expect(ids.has('schema/valid-yaml')).toBe(true);
    expect(ids.has('naming/id-kebab-case')).toBe(true);
    expect(ids.has('ownership/required')).toBe(true);
    expect(ids.has('descriptions/required')).toBe(true);
    expect(ids.has('references/resolvable')).toBe(true);
    expect(ids.has('glossary/no-duplicate-terms')).toBe(true);
    expect(ids.has('concepts/certified-requires-evidence')).toBe(true);
    expect(ids.has('policies/unknown-subject')).toBe(true);
    expect(ids.has('policies/deny-overrides-allow')).toBe(true);
    expect(ids.has('docs/examples-required')).toBe(true);
    expect(ids.has('deprecation/require-sunset')).toBe(true);
    expect(ids.has('packaging/no-secrets')).toBe(true);
  });
});
