import { describe, it, expect } from 'vitest';
import type { DataValidationInfo, OsiSemanticModel } from '../../types/index.js';
import { createEmptyGraph } from '../../compiler/graph.js';

// Data-aware rules
import { dataSourceExists } from '../rules/data-source-exists.js';
import { dataFieldsExist } from '../rules/data-fields-exist.js';
import { dataFieldTypesCompatible } from '../rules/data-field-types-compatible.js';
import { dataSampleValuesAccurate } from '../rules/data-sample-values-accurate.js';
import { dataGoldenQueriesExecute } from '../rules/data-golden-queries-execute.js';
import { dataGoldenQueriesNonempty } from '../rules/data-golden-queries-nonempty.js';
import { dataGuardrailsValidSql } from '../rules/data-guardrails-valid-sql.js';
import { dataRowCountsNonzero } from '../rules/data-row-counts-nonzero.js';

import { ALL_RULES } from '../rules/index.js';

function makeDataValidation(overrides: Partial<DataValidationInfo> = {}): DataValidationInfo {
  return {
    existingTables: new Map(),
    existingColumns: new Map(),
    actualSampleValues: new Map(),
    goldenQueryResults: new Map(),
    guardrailResults: new Map(),
    ...overrides,
  };
}

/** Minimal OSI model for data-aware testing. */
function minimalModel(name: string): OsiSemanticModel {
  return {
    name,
    description: 'A test model',
    datasets: [
      {
        name: 'users',
        source: 'db.main.users',
        description: 'Users dataset',
        fields: [
          {
            name: 'user_id',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'user_id' }] },
            description: 'Primary key',
          },
          {
            name: 'email',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'email' }] },
            description: 'Email address',
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// ALL_RULES count includes data-aware rules
// ---------------------------------------------------------------------------
describe('ALL_RULES includes data-aware rules', () => {
  it('ALL_RULES array contains 33 rules (25 original + 8 data-aware)', () => {
    expect(ALL_RULES).toHaveLength(33);
  });

  it('all data-aware rules are present by id', () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(ids).toContain('data/source-exists');
    expect(ids).toContain('data/fields-exist');
    expect(ids).toContain('data/field-types-compatible');
    expect(ids).toContain('data/sample-values-accurate');
    expect(ids).toContain('data/golden-queries-execute');
    expect(ids).toContain('data/golden-queries-nonempty');
    expect(ids).toContain('data/guardrails-valid-sql');
    expect(ids).toContain('data/row-counts-nonzero');
  });
});

// ---------------------------------------------------------------------------
// data/source-exists
// ---------------------------------------------------------------------------
describe('data/source-exists', () => {
  it('returns no diagnostics when skipped (no dataValidation)', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    expect(dataSourceExists.run(graph)).toHaveLength(0);
  });

  it('returns error when dataset table not found in DB', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.dataValidation = makeDataValidation({
      existingTables: new Map([['orders', 100]]),
    });
    const diags = dataSourceExists.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe('data/source-exists');
    expect(diags[0]!.message).toContain('users');
  });

  it('passes when table exists', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.dataValidation = makeDataValidation({
      existingTables: new Map([['users', 100]]),
    });
    expect(dataSourceExists.run(graph)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// data/fields-exist
// ---------------------------------------------------------------------------
describe('data/fields-exist', () => {
  it('returns no diagnostics when skipped (no dataValidation)', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    expect(dataFieldsExist.run(graph)).toHaveLength(0);
  });

  it('returns error when field not found as column', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.dataValidation = makeDataValidation({
      existingColumns: new Map([
        ['users', new Map([['user_id', 'INTEGER'], ['incident_id', 'INTEGER']])],
      ]),
    });
    const diags = dataFieldsExist.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe('data/fields-exist');
    expect(diags[0]!.message).toContain('email');
  });

  it('passes when all fields exist as columns', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.dataValidation = makeDataValidation({
      existingColumns: new Map([
        ['users', new Map([['user_id', 'INTEGER'], ['email', 'VARCHAR']])],
      ]),
    });
    expect(dataFieldsExist.run(graph)).toHaveLength(0);
  });

  it('skips check when table not in existingColumns (deferred to source-exists)', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.dataValidation = makeDataValidation({
      existingColumns: new Map(), // no columns info for "users"
    });
    expect(dataFieldsExist.run(graph)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// data/field-types-compatible
// ---------------------------------------------------------------------------
describe('data/field-types-compatible', () => {
  it('returns no diagnostics when skipped (no dataValidation)', () => {
    const graph = createEmptyGraph();
    expect(dataFieldTypesCompatible.run(graph)).toHaveLength(0);
  });

  it('returns warning when metric role has incompatible type', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'users.email': { semantic_role: 'metric' },
      },
    });
    graph.dataValidation = makeDataValidation({
      existingColumns: new Map([
        ['users', new Map([['user_id', 'INTEGER'], ['email', 'VARCHAR']])],
      ]),
    });
    const diags = dataFieldTypesCompatible.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe('data/field-types-compatible');
    expect(diags[0]!.message).toContain('metric');
    expect(diags[0]!.message).toContain('VARCHAR');
  });

  it('passes when metric role has compatible numeric type', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'users.user_id': { semantic_role: 'metric' },
      },
    });
    graph.dataValidation = makeDataValidation({
      existingColumns: new Map([
        ['users', new Map([['user_id', 'INTEGER'], ['email', 'VARCHAR']])],
      ]),
    });
    expect(dataFieldTypesCompatible.run(graph)).toHaveLength(0);
  });

  it('returns warning when date role has non-date type', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'users.email': { semantic_role: 'date' },
      },
    });
    graph.dataValidation = makeDataValidation({
      existingColumns: new Map([
        ['users', new Map([['email', 'VARCHAR']])],
      ]),
    });
    const diags = dataFieldTypesCompatible.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('date');
  });
});

// ---------------------------------------------------------------------------
// data/sample-values-accurate
// ---------------------------------------------------------------------------
describe('data/sample-values-accurate', () => {
  it('returns no diagnostics when skipped (no dataValidation)', () => {
    const graph = createEmptyGraph();
    expect(dataSampleValuesAccurate.run(graph)).toHaveLength(0);
  });

  it('returns warning when sample values not found in actual data', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'users.status': { semantic_role: 'dimension', sample_values: ['active', 'deleted', 'banned'] },
      },
    });
    graph.dataValidation = makeDataValidation({
      actualSampleValues: new Map([
        ['users.status', ['active', 'inactive', 'pending']],
      ]),
    });
    const diags = dataSampleValuesAccurate.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe('data/sample-values-accurate');
    expect(diags[0]!.message).toContain('deleted');
    expect(diags[0]!.message).toContain('banned');
  });

  it('passes when all sample values found in actual data', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'users.status': { semantic_role: 'dimension', sample_values: ['active', 'inactive'] },
      },
    });
    graph.dataValidation = makeDataValidation({
      actualSampleValues: new Map([
        ['users.status', ['active', 'inactive', 'pending']],
      ]),
    });
    expect(dataSampleValuesAccurate.run(graph)).toHaveLength(0);
  });

  it('skips fields without sample_values', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'users.user_id': { semantic_role: 'identifier' },
      },
    });
    graph.dataValidation = makeDataValidation();
    expect(dataSampleValuesAccurate.run(graph)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// data/golden-queries-execute
// ---------------------------------------------------------------------------
describe('data/golden-queries-execute', () => {
  it('returns no diagnostics when skipped (no dataValidation)', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      golden_queries: [{ question: 'Q1', sql: 'SELECT 1' }],
    });
    expect(dataGoldenQueriesExecute.run(graph)).toHaveLength(0);
  });

  it('returns error when golden query fails', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      golden_queries: [
        { question: 'Total users', sql: 'SELECT count(*) FROM users' },
        { question: 'Bad query', sql: 'SELECT * FROM nonexistent' },
      ],
    });
    graph.dataValidation = makeDataValidation({
      goldenQueryResults: new Map([
        [0, { success: true, rowCount: 5 }],
        [1, { success: false, error: 'relation "nonexistent" does not exist' }],
      ]),
    });
    const diags = dataGoldenQueriesExecute.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe('data/golden-queries-execute');
    expect(diags[0]!.message).toContain('#2');
    expect(diags[0]!.message).toContain('Bad query');
  });

  it('passes when all golden queries succeed', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      golden_queries: [
        { question: 'Q1', sql: 'SELECT 1' },
        { question: 'Q2', sql: 'SELECT 2' },
      ],
    });
    graph.dataValidation = makeDataValidation({
      goldenQueryResults: new Map([
        [0, { success: true, rowCount: 1 }],
        [1, { success: true, rowCount: 1 }],
      ]),
    });
    expect(dataGoldenQueriesExecute.run(graph)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// data/golden-queries-nonempty
// ---------------------------------------------------------------------------
describe('data/golden-queries-nonempty', () => {
  it('returns no diagnostics when skipped (no dataValidation)', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      golden_queries: [{ question: 'Q1', sql: 'SELECT 1' }],
    });
    expect(dataGoldenQueriesNonempty.run(graph)).toHaveLength(0);
  });

  it('returns warning when golden query returns 0 rows', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      golden_queries: [
        { question: 'Q1', sql: 'SELECT 1' },
        { question: 'Empty result', sql: 'SELECT * FROM users WHERE 1=0' },
      ],
    });
    graph.dataValidation = makeDataValidation({
      goldenQueryResults: new Map([
        [0, { success: true, rowCount: 5 }],
        [1, { success: true, rowCount: 0 }],
      ]),
    });
    const diags = dataGoldenQueriesNonempty.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe('data/golden-queries-nonempty');
    expect(diags[0]!.message).toContain('#2');
    expect(diags[0]!.message).toContain('0 rows');
  });

  it('skips failed queries (handled by golden-queries-execute)', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      golden_queries: [{ question: 'Bad', sql: 'INVALID' }],
    });
    graph.dataValidation = makeDataValidation({
      goldenQueryResults: new Map([
        [0, { success: false, error: 'syntax error' }],
      ]),
    });
    expect(dataGoldenQueriesNonempty.run(graph)).toHaveLength(0);
  });

  it('passes when all successful queries return rows', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      golden_queries: [
        { question: 'Q1', sql: 'SELECT 1' },
      ],
    });
    graph.dataValidation = makeDataValidation({
      goldenQueryResults: new Map([
        [0, { success: true, rowCount: 10 }],
      ]),
    });
    expect(dataGoldenQueriesNonempty.run(graph)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// data/guardrails-valid-sql
// ---------------------------------------------------------------------------
describe('data/guardrails-valid-sql', () => {
  it('returns no diagnostics when skipped (no dataValidation)', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      guardrail_filters: [{ name: 'g1', filter: 'x > 0', reason: 'test' }],
    });
    expect(dataGuardrailsValidSql.run(graph)).toHaveLength(0);
  });

  it('returns error when guardrail filter has invalid SQL', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      guardrail_filters: [
        { name: 'valid-filter', filter: 'status = active', reason: 'test' },
        { name: 'bad-filter', filter: 'WHERE ??? INVALID', reason: 'test' },
      ],
    });
    graph.dataValidation = makeDataValidation({
      guardrailResults: new Map([
        [0, { valid: true }],
        [1, { valid: false, error: 'syntax error at position 6' }],
      ]),
    });
    const diags = dataGuardrailsValidSql.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe('data/guardrails-valid-sql');
    expect(diags[0]!.message).toContain('bad-filter');
  });

  it('passes when all guardrail filters are valid', () => {
    const graph = createEmptyGraph();
    graph.rules.set('m', {
      model: 'm',
      guardrail_filters: [
        { name: 'g1', filter: 'x > 0', reason: 'positive' },
      ],
    });
    graph.dataValidation = makeDataValidation({
      guardrailResults: new Map([
        [0, { valid: true }],
      ]),
    });
    expect(dataGuardrailsValidSql.run(graph)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// data/row-counts-nonzero
// ---------------------------------------------------------------------------
describe('data/row-counts-nonzero', () => {
  it('returns no diagnostics when skipped (no dataValidation)', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    expect(dataRowCountsNonzero.run(graph)).toHaveLength(0);
  });

  it('returns warning when table has 0 rows', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.dataValidation = makeDataValidation({
      existingTables: new Map([['users', 0]]),
    });
    const diags = dataRowCountsNonzero.run(graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.ruleId).toBe('data/row-counts-nonzero');
    expect(diags[0]!.message).toContain('0 rows');
    expect(diags[0]!.message).toContain('users');
  });

  it('passes when table has rows', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.dataValidation = makeDataValidation({
      existingTables: new Map([['users', 500]]),
    });
    expect(dataRowCountsNonzero.run(graph)).toHaveLength(0);
  });

  it('does not warn for tables not in existingTables (handled by source-exists)', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.dataValidation = makeDataValidation({
      existingTables: new Map(), // "users" not present
    });
    expect(dataRowCountsNonzero.run(graph)).toHaveLength(0);
  });
});
