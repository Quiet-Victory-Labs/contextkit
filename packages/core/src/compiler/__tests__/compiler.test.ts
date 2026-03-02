import { describe, it, expect } from 'vitest';
import path from 'node:path';
import type { ContextGraph, GovernanceFile, RulesFile, LineageFile, TermFile } from '../../types/index.js';
import type { ParsedFile } from '../../parser/index.js';
import { validate, type ValidateResult } from '../validate.js';
import { resolveReferences } from '../resolve.js';
import { buildGraph, createEmptyGraph } from '../graph.js';
import { compile } from '../pipeline.js';

const FIXTURES_VALID = path.resolve(__dirname, '../../../../../fixtures/valid');
const FIXTURES_INVALID = path.resolve(__dirname, '../../../../../fixtures/invalid');

// ---------------------------------------------------------------------------
// Helper: parse YAML fixtures into ParsedFile objects
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

function makeParsed(fixturePath: string, kind: ParsedFile['kind']): ParsedFile {
  const content = readFileSync(fixturePath, 'utf-8');
  const data = parseYaml(content);
  return { kind, data, source: { file: fixturePath, line: 1, column: 1 } };
}

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------
describe('validate', () => {
  it('validates a valid OSI model and returns the OsiSemanticModel', () => {
    const parsed = makeParsed(
      path.join(FIXTURES_VALID, 'models', 'retail-sales.osi.yaml'),
      'model',
    );
    const result = validate(parsed);
    expect(result.kind).toBe('model');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data).toBeDefined();
    // Should be the OsiSemanticModel, not the OsiDocument
    expect(result.data.name).toBe('retail-sales');
    expect(result.data.datasets).toBeDefined();
    expect(Array.isArray(result.data.datasets)).toBe(true);
  });

  it('validates a valid governance file', () => {
    const parsed = makeParsed(
      path.join(FIXTURES_VALID, 'governance', 'retail-sales.governance.yaml'),
      'governance',
    );
    const result = validate(parsed);
    expect(result.kind).toBe('governance');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data).toBeDefined();
    expect(result.data.model).toBe('retail-sales');
    expect(result.data.owner).toBe('analytics-team');
  });

  it('validates a valid rules file', () => {
    const parsed = makeParsed(
      path.join(FIXTURES_VALID, 'rules', 'retail-sales.rules.yaml'),
      'rules',
    );
    const result = validate(parsed);
    expect(result.kind).toBe('rules');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data).toBeDefined();
    expect(result.data.model).toBe('retail-sales');
  });

  it('validates a valid lineage file', () => {
    const parsed = makeParsed(
      path.join(FIXTURES_VALID, 'lineage', 'retail-sales.lineage.yaml'),
      'lineage',
    );
    const result = validate(parsed);
    expect(result.kind).toBe('lineage');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data).toBeDefined();
    expect(result.data.model).toBe('retail-sales');
  });

  it('validates a valid term file', () => {
    const parsed = makeParsed(
      path.join(FIXTURES_VALID, 'glossary', 'revenue.term.yaml'),
      'term',
    );
    const result = validate(parsed);
    expect(result.kind).toBe('term');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('revenue');
  });

  it('validates a valid owner file', () => {
    const parsed = makeParsed(
      path.join(FIXTURES_VALID, 'owners', 'analytics-team.owner.yaml'),
      'owner',
    );
    const result = validate(parsed);
    expect(result.kind).toBe('owner');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('analytics-team');
  });

  it('returns diagnostics for invalid OSI (missing version)', () => {
    const parsed = makeParsed(
      path.join(FIXTURES_INVALID, 'models', 'bad-model.osi.yaml'),
      'model',
    );
    const result = validate(parsed);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.severity).toBe('error');
    expect(result.diagnostics[0]!.ruleId).toBe('schema/invalid');
  });

  it('returns diagnostics for invalid governance (missing model)', () => {
    const parsed = makeParsed(
      path.join(FIXTURES_INVALID, 'governance', 'bad-governance.governance.yaml'),
      'governance',
    );
    const result = validate(parsed);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.severity).toBe('error');
    expect(result.diagnostics[0]!.ruleId).toBe('schema/invalid');
  });

  it('returns undefined data when validation fails', () => {
    const parsed = makeParsed(
      path.join(FIXTURES_INVALID, 'models', 'bad-model.osi.yaml'),
      'model',
    );
    const result = validate(parsed);
    expect(result.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveReferences()
// ---------------------------------------------------------------------------
describe('resolveReferences', () => {
  /** Build a fully valid graph from the fixtures for use in reference tests. */
  function buildValidGraph(): ContextGraph {
    const modelParsed = makeParsed(
      path.join(FIXTURES_VALID, 'models', 'retail-sales.osi.yaml'),
      'model',
    );
    const govParsed = makeParsed(
      path.join(FIXTURES_VALID, 'governance', 'retail-sales.governance.yaml'),
      'governance',
    );
    const rulesParsed = makeParsed(
      path.join(FIXTURES_VALID, 'rules', 'retail-sales.rules.yaml'),
      'rules',
    );
    const lineageParsed = makeParsed(
      path.join(FIXTURES_VALID, 'lineage', 'retail-sales.lineage.yaml'),
      'lineage',
    );
    const termParsed = makeParsed(
      path.join(FIXTURES_VALID, 'glossary', 'revenue.term.yaml'),
      'term',
    );
    const ownerParsed = makeParsed(
      path.join(FIXTURES_VALID, 'owners', 'analytics-team.owner.yaml'),
      'owner',
    );

    const results = [modelParsed, govParsed, rulesParsed, lineageParsed, termParsed, ownerParsed].map(validate);
    return buildGraph(results);
  }

  it('returns no diagnostics when all references resolve', () => {
    const graph = buildValidGraph();
    const diagnostics = resolveReferences(graph);
    expect(diagnostics).toHaveLength(0);
  });

  it('detects missing model reference in governance', () => {
    const graph = buildValidGraph();
    // Replace governance to reference a non-existent model
    graph.governance.clear();
    const badGov: GovernanceFile = {
      model: 'nonexistent-model',
      owner: 'analytics-team',
    };
    graph.governance.set('nonexistent-model', badGov);
    const diagnostics = resolveReferences(graph);
    const modelDiag = diagnostics.find((d) => d.ruleId === 'references/model-exists');
    expect(modelDiag).toBeDefined();
    expect(modelDiag!.message).toContain('nonexistent-model');
  });

  it('detects missing owner reference in governance', () => {
    const graph = buildValidGraph();
    // Replace governance to reference a non-existent owner
    graph.governance.clear();
    const badGov: GovernanceFile = {
      model: 'retail-sales',
      owner: 'nonexistent-owner',
    };
    graph.governance.set('retail-sales', badGov);
    const diagnostics = resolveReferences(graph);
    const ownerDiag = diagnostics.find((d) => d.ruleId === 'references/owner-exists');
    expect(ownerDiag).toBeDefined();
    expect(ownerDiag!.message).toContain('nonexistent-owner');
  });

  it('detects missing dataset in governance.datasets', () => {
    const graph = buildValidGraph();
    graph.governance.clear();
    const badGov: GovernanceFile = {
      model: 'retail-sales',
      owner: 'analytics-team',
      datasets: {
        nonexistent_table: {
          grain: 'One row',
          table_type: 'fact',
        },
      },
    };
    graph.governance.set('retail-sales', badGov);
    const diagnostics = resolveReferences(graph);
    const dsDiag = diagnostics.find((d) => d.ruleId === 'references/dataset-exists');
    expect(dsDiag).toBeDefined();
    expect(dsDiag!.message).toContain('nonexistent_table');
  });

  it('detects missing field in governance.fields', () => {
    const graph = buildValidGraph();
    graph.governance.clear();
    const badGov: GovernanceFile = {
      model: 'retail-sales',
      owner: 'analytics-team',
      fields: {
        'transactions.nonexistent_field': {
          semantic_role: 'metric',
        },
      },
    };
    graph.governance.set('retail-sales', badGov);
    const diagnostics = resolveReferences(graph);
    const fieldDiag = diagnostics.find((d) => d.ruleId === 'references/field-exists');
    expect(fieldDiag).toBeDefined();
    expect(fieldDiag!.message).toContain('nonexistent_field');
  });

  it('detects missing model reference in rules', () => {
    const graph = buildValidGraph();
    graph.rules.clear();
    const badRules: RulesFile = {
      model: 'nonexistent-model',
    };
    graph.rules.set('nonexistent-model', badRules);
    const diagnostics = resolveReferences(graph);
    const modelDiag = diagnostics.find(
      (d) => d.ruleId === 'references/model-exists' && d.message.toLowerCase().includes('rules'),
    );
    expect(modelDiag).toBeDefined();
  });

  it('detects missing table in rules.business_rules', () => {
    const graph = buildValidGraph();
    graph.rules.clear();
    const badRules: RulesFile = {
      model: 'retail-sales',
      business_rules: [
        {
          name: 'test-rule',
          definition: 'Test',
          tables: ['nonexistent_table'],
        },
      ],
    };
    graph.rules.set('retail-sales', badRules);
    const diagnostics = resolveReferences(graph);
    const tableDiag = diagnostics.find((d) => d.ruleId === 'references/table-exists');
    expect(tableDiag).toBeDefined();
    expect(tableDiag!.message).toContain('nonexistent_table');
  });

  it('detects missing model reference in lineage', () => {
    const graph = buildValidGraph();
    graph.lineage.clear();
    const badLineage: LineageFile = {
      model: 'nonexistent-model',
    };
    graph.lineage.set('nonexistent-model', badLineage);
    const diagnostics = resolveReferences(graph);
    const modelDiag = diagnostics.find(
      (d) => d.ruleId === 'references/model-exists' && d.message.toLowerCase().includes('lineage'),
    );
    expect(modelDiag).toBeDefined();
  });

  it('detects missing owner in term', () => {
    const graph = buildValidGraph();
    graph.terms.clear();
    const badTerm: TermFile = {
      id: 'test-term',
      definition: 'Test',
      owner: 'nonexistent-owner',
    };
    graph.terms.set('test-term', badTerm);
    const diagnostics = resolveReferences(graph);
    const ownerDiag = diagnostics.find(
      (d) => d.ruleId === 'references/owner-exists' && d.message.includes('term'),
    );
    expect(ownerDiag).toBeDefined();
  });

  it('detects missing maps_to term reference', () => {
    const graph = buildValidGraph();
    graph.terms.clear();
    const badTerm: TermFile = {
      id: 'test-term',
      definition: 'Test',
      maps_to: ['nonexistent-term'],
    };
    graph.terms.set('test-term', badTerm);
    const diagnostics = resolveReferences(graph);
    const termDiag = diagnostics.find((d) => d.ruleId === 'references/term-exists');
    expect(termDiag).toBeDefined();
    expect(termDiag!.message).toContain('nonexistent-term');
  });
});

// ---------------------------------------------------------------------------
// buildGraph()
// ---------------------------------------------------------------------------
describe('buildGraph', () => {
  it('builds graph with all node types', () => {
    const results: ValidateResult[] = [
      validate(makeParsed(path.join(FIXTURES_VALID, 'models', 'retail-sales.osi.yaml'), 'model')),
      validate(makeParsed(path.join(FIXTURES_VALID, 'governance', 'retail-sales.governance.yaml'), 'governance')),
      validate(makeParsed(path.join(FIXTURES_VALID, 'rules', 'retail-sales.rules.yaml'), 'rules')),
      validate(makeParsed(path.join(FIXTURES_VALID, 'lineage', 'retail-sales.lineage.yaml'), 'lineage')),
      validate(makeParsed(path.join(FIXTURES_VALID, 'glossary', 'revenue.term.yaml'), 'term')),
      validate(makeParsed(path.join(FIXTURES_VALID, 'owners', 'analytics-team.owner.yaml'), 'owner')),
    ];

    const graph = buildGraph(results);

    expect(graph.models.size).toBe(1);
    expect(graph.models.has('retail-sales')).toBe(true);
    expect(graph.governance.size).toBe(1);
    expect(graph.governance.has('retail-sales')).toBe(true);
    expect(graph.rules.size).toBe(1);
    expect(graph.rules.has('retail-sales')).toBe(true);
    expect(graph.lineage.size).toBe(1);
    expect(graph.lineage.has('retail-sales')).toBe(true);
    expect(graph.terms.size).toBe(1);
    expect(graph.terms.has('revenue')).toBe(true);
    expect(graph.owners.size).toBe(1);
    expect(graph.owners.has('analytics-team')).toBe(true);
  });

  it('populates indexes correctly', () => {
    const results: ValidateResult[] = [
      validate(makeParsed(path.join(FIXTURES_VALID, 'models', 'retail-sales.osi.yaml'), 'model')),
      validate(makeParsed(path.join(FIXTURES_VALID, 'governance', 'retail-sales.governance.yaml'), 'governance')),
      validate(makeParsed(path.join(FIXTURES_VALID, 'rules', 'retail-sales.rules.yaml'), 'rules')),
      validate(makeParsed(path.join(FIXTURES_VALID, 'lineage', 'retail-sales.lineage.yaml'), 'lineage')),
    ];

    const graph = buildGraph(results);

    // byOwner: analytics-team → [retail-sales]
    expect(graph.indexes.byOwner.get('analytics-team')).toContain('retail-sales');

    // byTag: finance → [retail-sales]
    expect(graph.indexes.byTag.get('finance')).toContain('retail-sales');
    expect(graph.indexes.byTag.get('revenue')).toContain('retail-sales');
    expect(graph.indexes.byTag.get('kpi')).toContain('retail-sales');

    // byTrust: endorsed → [retail-sales]
    expect(graph.indexes.byTrust.get('endorsed')).toContain('retail-sales');

    // modelToGovernance
    expect(graph.indexes.modelToGovernance.get('retail-sales')).toBe('retail-sales');

    // modelToRules
    expect(graph.indexes.modelToRules.get('retail-sales')).toBe('retail-sales');

    // modelToLineage
    expect(graph.indexes.modelToLineage.get('retail-sales')).toBe('retail-sales');
  });

  it('skips nodes with validation errors', () => {
    const badResult: ValidateResult = {
      kind: 'model',
      data: undefined,
      diagnostics: [
        {
          ruleId: 'schema/invalid',
          severity: 'error',
          message: 'Missing version',
          location: { file: 'test.yaml', line: 1, column: 1 },
          fixable: false,
        },
      ],
    };

    const graph = buildGraph([badResult]);
    expect(graph.models.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// compile()
// ---------------------------------------------------------------------------
describe('compile', () => {
  it('compiles valid fixtures with no error diagnostics and a populated graph', async () => {
    const result = await compile({ contextDir: FIXTURES_VALID });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);

    expect(result.graph.models.size).toBeGreaterThanOrEqual(1);
    expect(result.graph.governance.size).toBeGreaterThanOrEqual(1);
    expect(result.graph.rules.size).toBeGreaterThanOrEqual(1);
    expect(result.graph.lineage.size).toBeGreaterThanOrEqual(1);
    expect(result.graph.terms.size).toBeGreaterThanOrEqual(1);
    expect(result.graph.owners.size).toBeGreaterThanOrEqual(1);
  });

  it('compiles invalid fixtures and returns validation diagnostics', async () => {
    const result = await compile({ contextDir: FIXTURES_INVALID });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });
});
