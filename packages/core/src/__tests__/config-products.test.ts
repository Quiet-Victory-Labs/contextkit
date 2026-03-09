import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig } from '../config/loader.js';

function createTempConfig(content: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-config-test-'));
  fs.writeFileSync(path.join(tmpDir, 'runcontext.config.yaml'), content, 'utf-8');
  return tmpDir;
}

describe('config with products', () => {
  it('loads products list from runcontext.config.yaml', () => {
    const dir = createTempConfig(`
context_dir: context
products:
  - sales
  - marketing
glossary_dir: glossary
owners_dir: owners
`);
    const config = loadConfig(dir);
    expect(config.products).toEqual(['sales', 'marketing']);
    expect(config.glossary_dir).toBe('glossary');
    expect(config.owners_dir).toBe('owners');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to undefined products when not specified', () => {
    const dir = createTempConfig(`
context_dir: context
`);
    const config = loadConfig(dir);
    expect(config.products).toBeUndefined();
    expect(config.glossary_dir).toBeUndefined();
    expect(config.owners_dir).toBeUndefined();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads empty products array', () => {
    const dir = createTempConfig(`
context_dir: context
products: []
`);
    const config = loadConfig(dir);
    expect(config.products).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
