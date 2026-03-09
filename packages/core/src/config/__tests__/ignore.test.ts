import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadIgnorePatterns } from '../ignore.js';

describe('loadIgnorePatterns', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-ignore-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no .runcontext-ignore exists', () => {
    expect(loadIgnorePatterns(tmpDir)).toEqual([]);
  });

  it('loads patterns from .runcontext-ignore file', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.runcontext-ignore'),
      'drafts/**\narchive/**\n',
    );
    expect(loadIgnorePatterns(tmpDir)).toEqual(['drafts/**', 'archive/**']);
  });

  it('ignores comments and empty lines', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.runcontext-ignore'),
      '# This is a comment\n\ndrafts/**\n  \n# Another comment\narchive/**\n',
    );
    expect(loadIgnorePatterns(tmpDir)).toEqual(['drafts/**', 'archive/**']);
  });

  it('merges config ignore patterns', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.runcontext-ignore'),
      'drafts/**\n',
    );
    const result = loadIgnorePatterns(tmpDir, ['vendor/**']);
    expect(result).toEqual(['drafts/**', 'vendor/**']);
  });

  it('deduplicates patterns', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.runcontext-ignore'),
      'drafts/**\n',
    );
    const result = loadIgnorePatterns(tmpDir, ['drafts/**', 'vendor/**']);
    expect(result).toEqual(['drafts/**', 'vendor/**']);
  });

  it('returns only config patterns when no file exists', () => {
    const result = loadIgnorePatterns(tmpDir, ['vendor/**']);
    expect(result).toEqual(['vendor/**']);
  });
});
