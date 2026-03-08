import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { detectLayout, listProductNames } from '../migration/detect-layout.js';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ck-layout-'));
}

describe('detectLayout', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects flat layout when no products/ dir exists', () => {
    fs.mkdirSync(path.join(tmpDir, 'models'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'models', 'test.osi.yaml'), 'model: test');
    expect(detectLayout(tmpDir)).toBe('flat');
  });

  it('detects products layout when products/ has subdirs', () => {
    fs.mkdirSync(path.join(tmpDir, 'products', 'sales', 'models'), { recursive: true });
    expect(detectLayout(tmpDir)).toBe('products');
  });

  it('detects flat layout when products/ is empty', () => {
    fs.mkdirSync(path.join(tmpDir, 'products'), { recursive: true });
    expect(detectLayout(tmpDir)).toBe('flat');
  });

  it('detects flat layout when directory does not exist', () => {
    const nonExistent = path.join(tmpDir, 'nonexistent');
    expect(detectLayout(nonExistent)).toBe('flat');
  });
});

describe('listProductNames', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns product names sorted', () => {
    fs.mkdirSync(path.join(tmpDir, 'products', 'marketing'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'products', 'sales'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'products', 'analytics'), { recursive: true });
    expect(listProductNames(tmpDir)).toEqual(['analytics', 'marketing', 'sales']);
  });

  it('returns empty for flat layout', () => {
    expect(listProductNames(tmpDir)).toEqual([]);
  });

  it('ignores hidden directories', () => {
    fs.mkdirSync(path.join(tmpDir, 'products', '.hidden'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'products', 'sales'), { recursive: true });
    expect(listProductNames(tmpDir)).toEqual(['sales']);
  });
});
