import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { discoverFiles } from '../discover.js';
import { parseFile } from '../parse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../../../../fixtures/minimal');

describe('discoverFiles', () => {
  it('finds all context files in the minimal fixture', async () => {
    const files = await discoverFiles(join(FIXTURES, 'context'));
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files.some(f => f.endsWith('.ctx.yaml'))).toBe(true);
    expect(files.some(f => f.endsWith('.policy.yaml'))).toBe(true);
    expect(files.some(f => f.endsWith('.owner.yaml'))).toBe(true);
  });
});

describe('parseFile', () => {
  it('parses a concept YAML file', async () => {
    const result = await parseFile(join(FIXTURES, 'context/concepts/gross-revenue.ctx.yaml'));
    expect(result.fileType).toBe('concept');
    expect(result.data.id).toBe('gross-revenue');
    expect(result.data.definition).toBe('Total invoiced revenue before refunds or adjustments.');
    expect(result.data.owner).toBe('finance-team');
    expect(result.data.certified).toBe(true);
    expect(result.data.tags).toEqual(['finance', 'metric']);
  });

  it('parses a policy YAML file', async () => {
    const result = await parseFile(join(FIXTURES, 'context/policies/pii-access.policy.yaml'));
    expect(result.fileType).toBe('policy');
    expect(result.data.id).toBe('pii-access');
    expect(result.data.description).toBe('PII requires elevated role.');
    expect(Array.isArray(result.data.rules)).toBe(true);
  });

  it('parses a product YAML file', async () => {
    const result = await parseFile(join(FIXTURES, 'context/products/revenue-reporting.ctx.yaml'));
    expect(result.fileType).toBe('product');
    expect(result.data.id).toBe('revenue-reporting');
    expect(result.data.owner).toBe('finance-team');
    expect(result.data.tags).toEqual(['finance', 'certified']);
  });

  it('parses an owner YAML file', async () => {
    const result = await parseFile(join(FIXTURES, 'context/owners/finance-team.owner.yaml'));
    expect(result.fileType).toBe('owner');
    expect(result.data.id).toBe('finance-team');
    expect(result.data.display_name).toBe('Finance Team');
    expect(result.data.email).toBe('finance@acme.com');
    expect(result.data.team).toBe('Finance');
  });
});
