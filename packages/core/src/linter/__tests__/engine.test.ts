import { describe, it, expect } from 'vitest';
import { LintEngine } from '../engine.js';
import { namingIdKebabCase } from '../rules/naming-id-kebab-case.js';
import { ownershipRequired } from '../rules/ownership-required.js';
import { descriptionsRequired } from '../rules/descriptions-required.js';
import { schemaValidYaml } from '../rules/schema-valid-yaml.js';
import { buildGraph } from '../../graph/builder.js';
import type { ContextNode, Concept, Product, Entity, Owner, Term, Policy } from '../../types/index.js';

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
// Tests
// ---------------------------------------------------------------------------

describe('LintEngine', () => {
  describe('basic engine behaviour', () => {
    it('returns empty diagnostics when no rules are registered', () => {
      const engine = new LintEngine();
      const graph = buildGraph([makeConcept()]);
      const diagnostics = engine.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('returns empty diagnostics when all nodes are valid', () => {
      const engine = new LintEngine();
      engine.register(namingIdKebabCase);
      engine.register(ownershipRequired);
      engine.register(descriptionsRequired);

      const graph = buildGraph([
        makeOwner({ description: 'The finance team.' }),
        makeConcept(),
        makeProduct(),
        makeEntity(),
      ]);

      const diagnostics = engine.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('collects diagnostics from multiple rules', () => {
      const engine = new LintEngine();
      engine.register(namingIdKebabCase);
      engine.register(ownershipRequired);

      // BadId concept with no owner
      const graph = buildGraph([
        makeConcept({
          id: 'BadId',
          owner: undefined,
          source: { file: 'concepts/bad.ctx.yaml', line: 1, col: 1 },
        }),
      ]);

      const diagnostics = engine.run(graph);
      // At least one from naming, at least one from ownership
      const namingDiags = diagnostics.filter(d => d.ruleId === 'naming/id-kebab-case');
      const ownerDiags = diagnostics.filter(d => d.ruleId === 'ownership/required');
      expect(namingDiags.length).toBeGreaterThanOrEqual(1);
      expect(ownerDiags.length).toBeGreaterThanOrEqual(1);
    });

    it('sorts diagnostics by file then line', () => {
      const engine = new LintEngine();
      engine.register(namingIdKebabCase);

      const graph = buildGraph([
        makeConcept({
          id: 'BadId',
          source: { file: 'z-file.yaml', line: 5, col: 1 },
        }),
        makeProduct({
          id: 'AnotherBad',
          source: { file: 'a-file.yaml', line: 10, col: 1 },
        }),
        makeEntity({
          id: 'ThirdBad',
          source: { file: 'a-file.yaml', line: 2, col: 1 },
        }),
      ]);

      const diagnostics = engine.run(graph);
      expect(diagnostics.length).toBe(3);
      // a-file.yaml line 2 < a-file.yaml line 10 < z-file.yaml line 5
      expect(diagnostics[0].source.file).toBe('a-file.yaml');
      expect(diagnostics[0].source.line).toBe(2);
      expect(diagnostics[1].source.file).toBe('a-file.yaml');
      expect(diagnostics[1].source.line).toBe(10);
      expect(diagnostics[2].source.file).toBe('z-file.yaml');
      expect(diagnostics[2].source.line).toBe(5);
    });
  });

  describe('severity overrides', () => {
    it('disables a rule when override is "off"', () => {
      const engine = new LintEngine({ 'naming/id-kebab-case': 'off' });
      engine.register(namingIdKebabCase);

      const graph = buildGraph([
        makeConcept({ id: 'BadId' }),
      ]);

      const diagnostics = engine.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('overrides severity from error to warning', () => {
      const engine = new LintEngine({ 'naming/id-kebab-case': 'warning' });
      engine.register(namingIdKebabCase);

      const graph = buildGraph([
        makeConcept({ id: 'BadId' }),
      ]);

      const diagnostics = engine.run(graph);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe('warning');
    });

    it('overrides severity from warning to error', () => {
      const engine = new LintEngine({ 'descriptions/required': 'error' });
      engine.register(descriptionsRequired);

      // Owner has no description/definition
      const graph = buildGraph([
        makeOwner(),
      ]);

      const diagnostics = engine.run(graph);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe('error');
    });
  });

  describe('schema/valid-yaml rule', () => {
    it('always returns empty diagnostics (placeholder)', () => {
      const graph = buildGraph([makeConcept()]);
      const diagnostics = schemaValidYaml.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('has correct metadata', () => {
      expect(schemaValidYaml.id).toBe('schema/valid-yaml');
      expect(schemaValidYaml.defaultSeverity).toBe('error');
      expect(schemaValidYaml.fixable).toBe(false);
      expect(schemaValidYaml.description).toBe('Validates YAML against Zod schemas');
    });
  });

  describe('naming/id-kebab-case rule', () => {
    it('passes for valid kebab-case IDs', () => {
      const graph = buildGraph([
        makeConcept({ id: 'gross-revenue' }),
        makeProduct({ id: 'revenue-reporting' }),
        makeTerm({ id: 'arr' }),
        makeEntity({ id: 'customer-account' }),
      ]);

      const diagnostics = namingIdKebabCase.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('flags camelCase IDs', () => {
      const graph = buildGraph([
        makeConcept({ id: 'grossRevenue' }),
      ]);

      const diagnostics = namingIdKebabCase.run(graph);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].ruleId).toBe('naming/id-kebab-case');
      expect(diagnostics[0].severity).toBe('error');
      expect(diagnostics[0].fixable).toBe(true);
      expect(diagnostics[0].fix).toBeDefined();
    });

    it('flags PascalCase IDs', () => {
      const graph = buildGraph([
        makeConcept({ id: 'GrossRevenue' }),
      ]);

      const diagnostics = namingIdKebabCase.run(graph);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].fixable).toBe(true);
    });

    it('flags snake_case IDs', () => {
      const graph = buildGraph([
        makeConcept({ id: 'gross_revenue' }),
      ]);

      const diagnostics = namingIdKebabCase.run(graph);
      expect(diagnostics).toHaveLength(1);
    });

    it('flags IDs starting with a number', () => {
      const graph = buildGraph([
        makeConcept({ id: '1revenue' }),
      ]);

      const diagnostics = namingIdKebabCase.run(graph);
      expect(diagnostics).toHaveLength(1);
    });

    it('flags IDs with consecutive hyphens', () => {
      const graph = buildGraph([
        makeConcept({ id: 'gross--revenue' }),
      ]);

      const diagnostics = namingIdKebabCase.run(graph);
      expect(diagnostics).toHaveLength(1);
    });

    it('provides a fix that converts to kebab-case', () => {
      const graph = buildGraph([
        makeConcept({
          id: 'GrossRevenue',
          source: { file: 'concepts/gross.ctx.yaml', line: 1, col: 1 },
        }),
      ]);

      const diagnostics = namingIdKebabCase.run(graph);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].fix).toBeDefined();
      expect(diagnostics[0].fix!.description).toContain('gross-revenue');
    });
  });

  describe('ownership/required rule', () => {
    it('passes when concepts, products, and entities have owners', () => {
      const graph = buildGraph([
        makeConcept({ owner: 'finance-team' }),
        makeProduct({ owner: 'finance-team' }),
        makeEntity({ owner: 'finance-team' }),
      ]);

      const diagnostics = ownershipRequired.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('flags concepts without owner', () => {
      const graph = buildGraph([
        makeConcept({ owner: undefined }),
      ]);

      const diagnostics = ownershipRequired.run(graph);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].ruleId).toBe('ownership/required');
      expect(diagnostics[0].severity).toBe('error');
      expect(diagnostics[0].fixable).toBe(true);
      expect(diagnostics[0].fix).toBeDefined();
    });

    it('flags products without owner', () => {
      const graph = buildGraph([
        makeProduct({ owner: undefined }),
      ]);

      const diagnostics = ownershipRequired.run(graph);
      expect(diagnostics).toHaveLength(1);
    });

    it('flags entities without owner', () => {
      const graph = buildGraph([
        makeEntity({ owner: undefined }),
      ]);

      const diagnostics = ownershipRequired.run(graph);
      expect(diagnostics).toHaveLength(1);
    });

    it('does NOT flag terms without owner', () => {
      const graph = buildGraph([
        makeTerm({ owner: undefined }),
      ]);

      const diagnostics = ownershipRequired.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('does NOT flag owners without owner', () => {
      const graph = buildGraph([
        makeOwner(),
      ]);

      const diagnostics = ownershipRequired.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('does NOT flag policies without owner', () => {
      const graph = buildGraph([
        makePolicy({ owner: undefined }),
      ]);

      const diagnostics = ownershipRequired.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('flags owner with empty string', () => {
      const graph = buildGraph([
        makeConcept({ owner: '' }),
      ]);

      const diagnostics = ownershipRequired.run(graph);
      expect(diagnostics).toHaveLength(1);
    });
  });

  describe('descriptions/required rule', () => {
    it('passes when all nodes have description or definition', () => {
      const graph = buildGraph([
        makeConcept({ definition: 'A definition.' }),         // has definition
        makeProduct({ description: 'A description.' }),       // has description
        makeEntity({ definition: 'Entity def.' }),            // has definition
        makeTerm({ definition: 'Term def.' }),                // has definition
        makePolicy({ description: 'Policy desc.' }),          // has description
        makeOwner({ description: 'Owner desc.' }),            // has description
      ]);

      const diagnostics = descriptionsRequired.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('flags nodes missing both description and definition', () => {
      // Owner nodes have no required definition — only description (optional via BaseNode)
      const graph = buildGraph([
        makeOwner({ description: undefined }),
      ]);

      const diagnostics = descriptionsRequired.run(graph);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].ruleId).toBe('descriptions/required');
      expect(diagnostics[0].severity).toBe('warning');
      expect(diagnostics[0].fixable).toBe(true);
    });

    it('accepts definition as substitute for description', () => {
      // Concept has definition but no description — should pass
      const graph = buildGraph([
        makeConcept({ description: undefined }),
      ]);

      const diagnostics = descriptionsRequired.run(graph);
      expect(diagnostics).toEqual([]);
    });

    it('has correct metadata', () => {
      expect(descriptionsRequired.id).toBe('descriptions/required');
      expect(descriptionsRequired.defaultSeverity).toBe('warning');
      expect(descriptionsRequired.fixable).toBe(true);
    });
  });
});
