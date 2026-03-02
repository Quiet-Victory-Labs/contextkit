import { describe, it, expect } from 'vitest';
import type { Diagnostic } from '../../types/index.js';
import { applyFixes } from '../apply.js';

function makeDiag(
  file: string,
  fixable: boolean,
  edits: Diagnostic['fix'],
): Diagnostic {
  return {
    ruleId: 'test/rule',
    severity: 'warning',
    message: 'test issue',
    location: { file, line: 1, column: 1 },
    fixable,
    fix: edits,
  };
}

describe('applyFixes', () => {
  it('returns empty map when no fixable diagnostics', () => {
    const diags: Diagnostic[] = [
      makeDiag('a.yaml', false, undefined),
      makeDiag('b.yaml', false, undefined),
    ];
    const readFile = (_path: string) => 'content';
    const result = applyFixes(diags, readFile);
    expect(result.size).toBe(0);
  });

  it('returns empty map when diagnostics array is empty', () => {
    const readFile = (_path: string) => 'content';
    const result = applyFixes([], readFile);
    expect(result.size).toBe(0);
  });

  it('groups edits by file and applies them correctly', () => {
    const diags: Diagnostic[] = [
      makeDiag('a.yaml', true, {
        description: 'fix a',
        edits: [{ startLine: 1, startCol: 1, endLine: 1, endCol: 4, newText: 'FOO' }],
      }),
      makeDiag('b.yaml', true, {
        description: 'fix b',
        edits: [{ startLine: 1, startCol: 1, endLine: 1, endCol: 4, newText: 'BAR' }],
      }),
    ];
    const files: Record<string, string> = {
      'a.yaml': 'foo: 1',
      'b.yaml': 'baz: 2',
    };
    const readFile = (path: string) => files[path]!;
    const result = applyFixes(diags, readFile);
    expect(result.size).toBe(2);
    expect(result.get('a.yaml')).toBe('FOO: 1');
    expect(result.get('b.yaml')).toBe('BAR: 2');
  });

  it('applies edits in reverse order (bottom-to-top) to preserve positions', () => {
    // Two edits in the same file, one on line 1 and one on line 3.
    // If applied top-to-bottom, the second edit's position might shift.
    // By applying bottom-to-top, earlier positions remain stable.
    const diags: Diagnostic[] = [
      makeDiag('file.yaml', true, {
        description: 'fix line 1',
        edits: [{ startLine: 1, startCol: 1, endLine: 1, endCol: 4, newText: 'AAA' }],
      }),
      makeDiag('file.yaml', true, {
        description: 'fix line 3',
        edits: [{ startLine: 3, startCol: 1, endLine: 3, endCol: 4, newText: 'CCC' }],
      }),
    ];
    const content = 'foo\nbar\nbaz';
    const readFile = (_path: string) => content;
    const result = applyFixes(diags, readFile);
    expect(result.size).toBe(1);
    expect(result.get('file.yaml')).toBe('AAA\nbar\nCCC');
  });

  it('handles multiple edits within a single diagnostic fix', () => {
    const diags: Diagnostic[] = [
      makeDiag('file.yaml', true, {
        description: 'multi-edit fix',
        edits: [
          { startLine: 1, startCol: 1, endLine: 1, endCol: 4, newText: 'XXX' },
          { startLine: 3, startCol: 1, endLine: 3, endCol: 4, newText: 'ZZZ' },
        ],
      }),
    ];
    const content = 'foo\nbar\nbaz';
    const readFile = (_path: string) => content;
    const result = applyFixes(diags, readFile);
    expect(result.size).toBe(1);
    expect(result.get('file.yaml')).toBe('XXX\nbar\nZZZ');
  });

  it('skips fixable diagnostics without a fix object', () => {
    const diags: Diagnostic[] = [
      makeDiag('a.yaml', true, undefined), // fixable but no fix
      makeDiag('b.yaml', true, {
        description: 'real fix',
        edits: [{ startLine: 1, startCol: 1, endLine: 1, endCol: 4, newText: 'YAY' }],
      }),
    ];
    const files: Record<string, string> = {
      'a.yaml': 'foo: 1',
      'b.yaml': 'boo: 2',
    };
    const readFile = (path: string) => files[path]!;
    const result = applyFixes(diags, readFile);
    expect(result.size).toBe(1);
    expect(result.has('a.yaml')).toBe(false);
    expect(result.get('b.yaml')).toBe('YAY: 2');
  });

  it('applies a multi-line edit correctly', () => {
    const diags: Diagnostic[] = [
      makeDiag('file.yaml', true, {
        description: 'replace lines 2-3',
        edits: [{ startLine: 2, startCol: 1, endLine: 3, endCol: 4, newText: 'replaced' }],
      }),
    ];
    const readFile = (_path: string) => 'line1\nline2\nline3\nline4';
    const result = applyFixes(diags, readFile);
    expect(result.get('file.yaml')).toBe('line1\nreplacede3\nline4');
  });

  it('handles edits on the same line at different columns', () => {
    const diags: Diagnostic[] = [
      makeDiag('file.yaml', true, {
        description: 'fix col 1-3',
        edits: [{ startLine: 1, startCol: 1, endLine: 1, endCol: 3, newText: 'AB' }],
      }),
      makeDiag('file.yaml', true, {
        description: 'fix col 5-7',
        edits: [{ startLine: 1, startCol: 5, endLine: 1, endCol: 7, newText: 'EF' }],
      }),
    ];
    // "abcdefgh" — cols are 1-indexed
    // edit 1: replace cols 1-2 (ab) with AB => "ABcdefgh"
    // edit 2: replace cols 5-6 (ef) with EF => "ABcdEFgh"
    const readFile = (_path: string) => 'abcdefgh';
    const result = applyFixes(diags, readFile);
    expect(result.get('file.yaml')).toBe('ABcdEFgh');
  });
});
