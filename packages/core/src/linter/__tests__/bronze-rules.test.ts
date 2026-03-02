import { describe, it, expect } from 'vitest';
import path from 'node:path';
import type { ContextGraph, GovernanceFile, OsiSemanticModel } from '../../types/index.js';
import { compile } from '../../compiler/pipeline.js';
import { createEmptyGraph } from '../../compiler/graph.js';

// Import individual rules
import { namingIdKebabCase } from '../rules/naming-id-kebab-case.js';
import { descriptionsRequired } from '../rules/descriptions-required.js';
import { ownershipRequired } from '../rules/ownership-required.js';
import { referencesResolvable } from '../rules/references-resolvable.js';
import { glossaryNoDuplicateTerms } from '../rules/glossary-no-duplicate-terms.js';
import { noSecrets } from '../rules/no-secrets.js';
import { osiValidSchema } from '../rules/osi-valid-schema.js';
import { governanceModelExists } from '../rules/governance-model-exists.js';
import { governanceDatasetsExist } from '../rules/governance-datasets-exist.js';
import { governanceFieldsExist } from '../rules/governance-fields-exist.js';
import { governanceGrainRequired } from '../rules/governance-grain-required.js';
import { governanceSecurityRequired } from '../rules/governance-security-required.js';
import { ALL_RULES } from '../rules/index.js';

const FIXTURES_VALID = path.resolve(__dirname, '../../../../../fixtures/valid');

/** Minimal OSI model for testing. */
function minimalModel(name: string): OsiSemanticModel {
  return {
    name,
    description: 'A test model',
    datasets: [
      {
        name: 'test_table',
        source: 'db.schema.table',
        description: 'A test dataset',
        fields: [
          {
            name: 'id',
            expression: { dialects: [{ dialect: 'ANSI_SQL', expression: 'id' }] },
            description: 'Primary key',
          },
        ],
      },
    ],
  };
}

/** Build a valid graph from fixture files. */
async function validGraph(): Promise<ContextGraph> {
  const { graph } = await compile({ contextDir: FIXTURES_VALID });
  return graph;
}

// ---------------------------------------------------------------------------
// ALL_RULES on valid fixtures — no diagnostics
// ---------------------------------------------------------------------------
describe('Bronze rules on valid fixtures', () => {
  it('all rules produce 0 diagnostics on valid fixtures', async () => {
    const graph = await validGraph();
    for (const rule of ALL_RULES) {
      const diags = rule.run(graph);
      expect(diags, `Rule "${rule.id}" should produce no diagnostics on valid fixtures`).toHaveLength(0);
    }
  });

  it('ALL_RULES array contains 25 rules', () => {
    expect(ALL_RULES).toHaveLength(25);
  });
});

// ---------------------------------------------------------------------------
// naming-id-kebab-case
// ---------------------------------------------------------------------------
describe('naming-id-kebab-case', () => {
  it('passes for kebab-case owner IDs', () => {
    const graph = createEmptyGraph();
    graph.owners.set('analytics-team', {
      id: 'analytics-team',
      display_name: 'Analytics Team',
    });
    expect(namingIdKebabCase.run(graph)).toHaveLength(0);
  });

  it('fails on non-kebab-case owner ID', () => {
    const graph = createEmptyGraph();
    graph.owners.set('Bad_Name', {
      id: 'Bad_Name',
      display_name: 'Bad Name',
    });
    const diags = namingIdKebabCase.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('naming/id-kebab-case');
    expect(diags[0]!.message).toContain('Bad_Name');
  });

  it('fails on non-kebab-case term ID', () => {
    const graph = createEmptyGraph();
    graph.terms.set('BadTerm', {
      id: 'BadTerm',
      definition: 'A bad term',
    });
    const diags = namingIdKebabCase.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain('BadTerm');
  });
});

// ---------------------------------------------------------------------------
// descriptions-required
// ---------------------------------------------------------------------------
describe('descriptions-required', () => {
  it('passes when all descriptions present', () => {
    const graph = createEmptyGraph();
    graph.models.set('good-model', minimalModel('good-model'));
    expect(descriptionsRequired.run(graph)).toHaveLength(0);
  });

  it('fails on model without description', () => {
    const graph = createEmptyGraph();
    const model = minimalModel('bad-model');
    delete (model as any).description;
    graph.models.set('bad-model', model);
    const diags = descriptionsRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.message.includes('bad-model'))).toBe(true);
  });

  it('fails on dataset without description', () => {
    const graph = createEmptyGraph();
    const model = minimalModel('test-model');
    delete (model.datasets[0] as any).description;
    graph.models.set('test-model', model);
    const diags = descriptionsRequired.run(graph);
    expect(diags.some((d) => d.message.includes('test_table'))).toBe(true);
  });

  it('fails on field without description', () => {
    const graph = createEmptyGraph();
    const model = minimalModel('test-model');
    delete (model.datasets[0]!.fields![0] as any).description;
    graph.models.set('test-model', model);
    const diags = descriptionsRequired.run(graph);
    expect(diags.some((d) => d.message.includes('id'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ownership-required
// ---------------------------------------------------------------------------
describe('ownership-required', () => {
  it('passes when governance has owner', () => {
    const graph = createEmptyGraph();
    graph.governance.set('test', { model: 'test', owner: 'team-a' });
    expect(ownershipRequired.run(graph)).toHaveLength(0);
  });

  it('fails on governance without owner', () => {
    const graph = createEmptyGraph();
    graph.governance.set('test', { model: 'test', owner: '' });
    const diags = ownershipRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('governance/ownership-required');
  });
});

// ---------------------------------------------------------------------------
// references-resolvable
// ---------------------------------------------------------------------------
describe('references-resolvable', () => {
  it('returns no diagnostics on valid graph', async () => {
    const graph = await validGraph();
    expect(referencesResolvable.run(graph)).toHaveLength(0);
  });

  it('returns diagnostics for unresolvable references', () => {
    const graph = createEmptyGraph();
    graph.governance.set('bad', {
      model: 'nonexistent',
      owner: 'nonexistent-owner',
    });
    const diags = referencesResolvable.run(graph);
    expect(diags.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// glossary-no-duplicate-terms
// ---------------------------------------------------------------------------
describe('glossary-no-duplicate-terms', () => {
  it('passes when no duplicate synonyms', () => {
    const graph = createEmptyGraph();
    graph.terms.set('term-a', { id: 'term-a', definition: 'A', synonyms: ['alpha'] });
    graph.terms.set('term-b', { id: 'term-b', definition: 'B', synonyms: ['beta'] });
    expect(glossaryNoDuplicateTerms.run(graph)).toHaveLength(0);
  });

  it('fails when two terms share a synonym', () => {
    const graph = createEmptyGraph();
    graph.terms.set('term-a', { id: 'term-a', definition: 'A', synonyms: ['sales'] });
    graph.terms.set('term-b', { id: 'term-b', definition: 'B', synonyms: ['sales'] });
    const diags = glossaryNoDuplicateTerms.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain('sales');
  });
});

// ---------------------------------------------------------------------------
// no-secrets
// ---------------------------------------------------------------------------
describe('no-secrets', () => {
  it('passes on clean descriptions', () => {
    const graph = createEmptyGraph();
    graph.models.set('clean', minimalModel('clean'));
    expect(noSecrets.run(graph)).toHaveLength(0);
  });

  it('fails when description contains "password=abc123"', () => {
    const graph = createEmptyGraph();
    const model = minimalModel('leaky');
    model.description = 'Connection password=abc123 for the db';
    graph.models.set('leaky', model);
    const diags = noSecrets.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('security/no-secrets');
  });

  it('fails when description contains "api_key=sk-..."', () => {
    const graph = createEmptyGraph();
    const model = minimalModel('leaky');
    model.description = 'Use api_key=sk-1234567890 for auth';
    graph.models.set('leaky', model);
    const diags = noSecrets.run(graph);
    expect(diags.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// osi-valid-schema
// ---------------------------------------------------------------------------
describe('osi-valid-schema', () => {
  it('passes when model has datasets with entries', () => {
    const graph = createEmptyGraph();
    graph.models.set('good', minimalModel('good'));
    expect(osiValidSchema.run(graph)).toHaveLength(0);
  });

  it('fails when model has empty datasets array', () => {
    const graph = createEmptyGraph();
    const model: OsiSemanticModel = {
      name: 'empty-model',
      description: 'Empty model',
      datasets: [],
    };
    graph.models.set('empty-model', model);
    const diags = osiValidSchema.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain('empty-model');
  });
});

// ---------------------------------------------------------------------------
// governance-model-exists
// ---------------------------------------------------------------------------
describe('governance-model-exists', () => {
  it('passes when governance model exists', () => {
    const graph = createEmptyGraph();
    graph.models.set('my-model', minimalModel('my-model'));
    graph.governance.set('my-model', { model: 'my-model', owner: 'team' });
    expect(governanceModelExists.run(graph)).toHaveLength(0);
  });

  it('fails when governance references nonexistent model', () => {
    const graph = createEmptyGraph();
    graph.governance.set('missing', { model: 'nonexistent', owner: 'team' });
    const diags = governanceModelExists.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain('nonexistent');
  });
});

// ---------------------------------------------------------------------------
// governance-datasets-exist
// ---------------------------------------------------------------------------
describe('governance-datasets-exist', () => {
  it('passes when all governance datasets exist in model', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      datasets: {
        test_table: { grain: 'One row', table_type: 'fact' },
      },
    });
    expect(governanceDatasetsExist.run(graph)).toHaveLength(0);
  });

  it('fails when governance dataset does not exist in model', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      datasets: {
        nonexistent_ds: { grain: 'One row', table_type: 'fact' },
      },
    });
    const diags = governanceDatasetsExist.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain('nonexistent_ds');
  });
});

// ---------------------------------------------------------------------------
// governance-fields-exist
// ---------------------------------------------------------------------------
describe('governance-fields-exist', () => {
  it('passes when all governance fields exist in model', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'test_table.id': { semantic_role: 'identifier' },
      },
    });
    expect(governanceFieldsExist.run(graph)).toHaveLength(0);
  });

  it('fails when governance field does not exist in model', () => {
    const graph = createEmptyGraph();
    graph.models.set('m', minimalModel('m'));
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      fields: {
        'test_table.nonexistent_field': { semantic_role: 'metric' },
      },
    });
    const diags = governanceFieldsExist.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain('nonexistent_field');
  });
});

// ---------------------------------------------------------------------------
// governance-grain-required
// ---------------------------------------------------------------------------
describe('governance-grain-required', () => {
  it('passes when all datasets have grain', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      datasets: {
        ds: { grain: 'One row per record', table_type: 'fact' },
      },
    });
    expect(governanceGrainRequired.run(graph)).toHaveLength(0);
  });

  it('fails when dataset missing grain', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      datasets: {
        ds: { grain: '', table_type: 'fact' },
      },
    });
    const diags = governanceGrainRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('governance/grain-required');
  });
});

// ---------------------------------------------------------------------------
// governance-security-required
// ---------------------------------------------------------------------------
describe('governance-security-required', () => {
  it('passes when governance has security', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
      security: 'internal',
    });
    expect(governanceSecurityRequired.run(graph)).toHaveLength(0);
  });

  it('fails when governance missing security', () => {
    const graph = createEmptyGraph();
    graph.governance.set('m', {
      model: 'm',
      owner: 'team',
    });
    const diags = governanceSecurityRequired.run(graph);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe('governance/security-required');
  });
});
