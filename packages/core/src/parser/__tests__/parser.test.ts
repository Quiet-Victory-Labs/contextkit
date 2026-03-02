import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { discoverFiles, type FileKind } from '../discover.js';
import { parseFile } from '../parse.js';

const FIXTURES_VALID = path.resolve(__dirname, '../../../../../fixtures/valid');
const FIXTURES_INVALID = path.resolve(__dirname, '../../../../../fixtures/invalid');

// ---------------------------------------------------------------------------
// discoverFiles
// ---------------------------------------------------------------------------
describe('discoverFiles', () => {
  it('finds all 6 file types in the valid fixtures directory', async () => {
    const files = await discoverFiles(FIXTURES_VALID);
    const kinds = new Set(files.map((f) => f.kind));
    expect(kinds).toContain('model');
    expect(kinds).toContain('governance');
    expect(kinds).toContain('rules');
    expect(kinds).toContain('lineage');
    expect(kinds).toContain('term');
    expect(kinds).toContain('owner');
    expect(kinds.size).toBe(6);
  });

  it('returns correct kind for .osi.yaml files', async () => {
    const files = await discoverFiles(FIXTURES_VALID);
    const osiFiles = files.filter((f) => f.path.endsWith('.osi.yaml'));
    expect(osiFiles.length).toBeGreaterThanOrEqual(1);
    for (const f of osiFiles) {
      expect(f.kind).toBe('model');
    }
  });

  it('returns correct kind for .governance.yaml files', async () => {
    const files = await discoverFiles(FIXTURES_VALID);
    const govFiles = files.filter((f) => f.path.endsWith('.governance.yaml'));
    expect(govFiles.length).toBeGreaterThanOrEqual(1);
    for (const f of govFiles) {
      expect(f.kind).toBe('governance');
    }
  });

  it('returns correct kind for .rules.yaml files', async () => {
    const files = await discoverFiles(FIXTURES_VALID);
    const rulesFiles = files.filter((f) => f.path.endsWith('.rules.yaml'));
    expect(rulesFiles.length).toBeGreaterThanOrEqual(1);
    for (const f of rulesFiles) {
      expect(f.kind).toBe('rules');
    }
  });

  it('returns correct kind for .lineage.yaml files', async () => {
    const files = await discoverFiles(FIXTURES_VALID);
    const lineageFiles = files.filter((f) => f.path.endsWith('.lineage.yaml'));
    expect(lineageFiles.length).toBeGreaterThanOrEqual(1);
    for (const f of lineageFiles) {
      expect(f.kind).toBe('lineage');
    }
  });

  it('returns correct kind for .term.yaml files', async () => {
    const files = await discoverFiles(FIXTURES_VALID);
    const termFiles = files.filter((f) => f.path.endsWith('.term.yaml'));
    expect(termFiles.length).toBeGreaterThanOrEqual(1);
    for (const f of termFiles) {
      expect(f.kind).toBe('term');
    }
  });

  it('returns correct kind for .owner.yaml files', async () => {
    const files = await discoverFiles(FIXTURES_VALID);
    const ownerFiles = files.filter((f) => f.path.endsWith('.owner.yaml'));
    expect(ownerFiles.length).toBeGreaterThanOrEqual(1);
    for (const f of ownerFiles) {
      expect(f.kind).toBe('owner');
    }
  });

  it('returns absolute paths for all discovered files', async () => {
    const files = await discoverFiles(FIXTURES_VALID);
    for (const f of files) {
      expect(path.isAbsolute(f.path)).toBe(true);
    }
  });

  it('returns results sorted by path', async () => {
    const files = await discoverFiles(FIXTURES_VALID);
    const paths = files.map((f) => f.path);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
  });

  it('returns empty array for empty directory', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'contextkit-test-'));
    const files = await discoverFiles(tmpDir);
    expect(files).toEqual([]);
  });

  it('discovers files in the invalid fixtures directory', async () => {
    const files = await discoverFiles(FIXTURES_INVALID);
    expect(files.length).toBeGreaterThanOrEqual(2);
    const kinds = new Set(files.map((f) => f.kind));
    expect(kinds).toContain('model');
    expect(kinds).toContain('governance');
  });
});

// ---------------------------------------------------------------------------
// parseFile
// ---------------------------------------------------------------------------
describe('parseFile', () => {
  it('parses a valid OSI model YAML file', async () => {
    const filePath = path.join(FIXTURES_VALID, 'models', 'retail-sales.osi.yaml');
    const result = await parseFile(filePath, 'model');
    expect(result.kind).toBe('model');
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data['version']).toBe('1.0');
    expect(Array.isArray(data['semantic_model'])).toBe(true);
  });

  it('parses a valid governance YAML file', async () => {
    const filePath = path.join(FIXTURES_VALID, 'governance', 'retail-sales.governance.yaml');
    const result = await parseFile(filePath, 'governance');
    expect(result.kind).toBe('governance');
    const data = result.data as Record<string, unknown>;
    expect(data['model']).toBe('retail-sales');
    expect(data['owner']).toBe('analytics-team');
  });

  it('parses a valid rules YAML file', async () => {
    const filePath = path.join(FIXTURES_VALID, 'rules', 'retail-sales.rules.yaml');
    const result = await parseFile(filePath, 'rules');
    expect(result.kind).toBe('rules');
    const data = result.data as Record<string, unknown>;
    expect(data['model']).toBe('retail-sales');
    expect(Array.isArray(data['golden_queries'])).toBe(true);
  });

  it('parses a valid lineage YAML file', async () => {
    const filePath = path.join(FIXTURES_VALID, 'lineage', 'retail-sales.lineage.yaml');
    const result = await parseFile(filePath, 'lineage');
    expect(result.kind).toBe('lineage');
    const data = result.data as Record<string, unknown>;
    expect(data['model']).toBe('retail-sales');
  });

  it('parses a valid term YAML file', async () => {
    const filePath = path.join(FIXTURES_VALID, 'glossary', 'revenue.term.yaml');
    const result = await parseFile(filePath, 'term');
    expect(result.kind).toBe('term');
    const data = result.data as Record<string, unknown>;
    expect(data['id']).toBe('revenue');
    expect(data['definition']).toBeDefined();
  });

  it('parses a valid owner YAML file', async () => {
    const filePath = path.join(FIXTURES_VALID, 'owners', 'analytics-team.owner.yaml');
    const result = await parseFile(filePath, 'owner');
    expect(result.kind).toBe('owner');
    const data = result.data as Record<string, unknown>;
    expect(data['id']).toBe('analytics-team');
    expect(data['display_name']).toBe('Analytics Team');
  });

  it('returns correct kind in the result', async () => {
    const kinds: FileKind[] = ['model', 'governance', 'rules', 'lineage', 'term', 'owner'];
    const filePaths: Record<FileKind, string> = {
      model: path.join(FIXTURES_VALID, 'models', 'retail-sales.osi.yaml'),
      governance: path.join(FIXTURES_VALID, 'governance', 'retail-sales.governance.yaml'),
      rules: path.join(FIXTURES_VALID, 'rules', 'retail-sales.rules.yaml'),
      lineage: path.join(FIXTURES_VALID, 'lineage', 'retail-sales.lineage.yaml'),
      term: path.join(FIXTURES_VALID, 'glossary', 'revenue.term.yaml'),
      owner: path.join(FIXTURES_VALID, 'owners', 'analytics-team.owner.yaml'),
    };
    for (const kind of kinds) {
      const result = await parseFile(filePaths[kind], kind);
      expect(result.kind).toBe(kind);
    }
  });

  it('returns source location with file path', async () => {
    const filePath = path.join(FIXTURES_VALID, 'models', 'retail-sales.osi.yaml');
    const result = await parseFile(filePath, 'model');
    expect(result.source.file).toBe(filePath);
    expect(result.source.line).toBe(1);
    expect(result.source.column).toBe(1);
  });

  it('throws on invalid YAML syntax', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'contextkit-bad-yaml-'));
    const badFile = path.join(tmpDir, 'bad.osi.yaml');
    await writeFile(badFile, ':\n  - :\n  invalid: [unclosed', 'utf-8');
    await expect(parseFile(badFile, 'model')).rejects.toThrow();
  });

  it('throws when file does not exist', async () => {
    const nonExistent = path.join(os.tmpdir(), 'does-not-exist-12345.osi.yaml');
    await expect(parseFile(nonExistent, 'model')).rejects.toThrow();
  });
});
