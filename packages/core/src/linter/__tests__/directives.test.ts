import { describe, it, expect } from 'vitest';
import { extractDirectives, filterByDirectives } from '../directives.js';
import type { Diagnostic } from '../../types/diagnostics.js';

const makeDiag = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  ruleId: 'test/rule',
  severity: 'warning',
  message: 'Test message',
  location: { file: 'test.yaml', line: 5, column: 1 },
  fixable: false,
  ...overrides,
});

describe('extractDirectives', () => {
  it('extracts contextkit-disable with rule', () => {
    const content = '# contextkit-disable test/rule\nsome: value\n';
    const directives = extractDirectives('test.yaml', content);

    expect(directives).toHaveLength(1);
    expect(directives[0]).toEqual({
      file: 'test.yaml',
      line: 1,
      type: 'disable',
      ruleId: 'test/rule',
    });
  });

  it('extracts contextkit-disable without rule (all rules)', () => {
    const content = '# contextkit-disable\nsome: value\n';
    const directives = extractDirectives('test.yaml', content);

    expect(directives).toHaveLength(1);
    expect(directives[0]!.ruleId).toBeUndefined();
    expect(directives[0]!.type).toBe('disable');
  });

  it('extracts contextkit-disable-next-line', () => {
    const content = 'first: a\n# contextkit-disable-next-line test/rule\nsecond: b\n';
    const directives = extractDirectives('test.yaml', content);

    expect(directives).toHaveLength(1);
    expect(directives[0]).toEqual({
      file: 'test.yaml',
      line: 2,
      type: 'disable-next-line',
      ruleId: 'test/rule',
    });
  });

  it('handles multiple directives', () => {
    const content = [
      '# contextkit-disable rule/a',
      'some: value',
      '# contextkit-disable-next-line rule/b',
      'other: value',
    ].join('\n');
    const directives = extractDirectives('test.yaml', content);

    expect(directives).toHaveLength(2);
  });

  it('returns empty array for no directives', () => {
    const content = '# just a comment\nsome: value\n';
    const directives = extractDirectives('test.yaml', content);

    expect(directives).toHaveLength(0);
  });
});

describe('filterByDirectives', () => {
  it('returns all diagnostics when no directives', () => {
    const diags = [makeDiag()];
    expect(filterByDirectives(diags, [])).toEqual(diags);
  });

  it('filters diagnostics suppressed by disable', () => {
    const diags = [
      makeDiag({ ruleId: 'test/rule', location: { file: 'test.yaml', line: 5, column: 1 } }),
    ];
    const directives = [
      { file: 'test.yaml', line: 1, type: 'disable' as const, ruleId: 'test/rule' },
    ];
    expect(filterByDirectives(diags, directives)).toHaveLength(0);
  });

  it('does not filter diagnostics before disable line', () => {
    const diags = [
      makeDiag({ location: { file: 'test.yaml', line: 2, column: 1 } }),
    ];
    const directives = [
      { file: 'test.yaml', line: 5, type: 'disable' as const, ruleId: 'test/rule' },
    ];
    expect(filterByDirectives(diags, directives)).toHaveLength(1);
  });

  it('filters diagnostics on the next line for disable-next-line', () => {
    const diags = [
      makeDiag({ location: { file: 'test.yaml', line: 3, column: 1 } }),
    ];
    const directives = [
      { file: 'test.yaml', line: 2, type: 'disable-next-line' as const, ruleId: 'test/rule' },
    ];
    expect(filterByDirectives(diags, directives)).toHaveLength(0);
  });

  it('does not filter diagnostics two lines after disable-next-line', () => {
    const diags = [
      makeDiag({ location: { file: 'test.yaml', line: 4, column: 1 } }),
    ];
    const directives = [
      { file: 'test.yaml', line: 2, type: 'disable-next-line' as const, ruleId: 'test/rule' },
    ];
    expect(filterByDirectives(diags, directives)).toHaveLength(1);
  });

  it('only filters matching rule', () => {
    const diags = [
      makeDiag({ ruleId: 'other/rule', location: { file: 'test.yaml', line: 5, column: 1 } }),
    ];
    const directives = [
      { file: 'test.yaml', line: 1, type: 'disable' as const, ruleId: 'test/rule' },
    ];
    expect(filterByDirectives(diags, directives)).toHaveLength(1);
  });

  it('disable without ruleId suppresses all rules', () => {
    const diags = [
      makeDiag({ ruleId: 'any/rule', location: { file: 'test.yaml', line: 5, column: 1 } }),
      makeDiag({ ruleId: 'other/rule', location: { file: 'test.yaml', line: 6, column: 1 } }),
    ];
    const directives = [
      { file: 'test.yaml', line: 1, type: 'disable' as const, ruleId: undefined },
    ];
    expect(filterByDirectives(diags, directives)).toHaveLength(0);
  });

  it('does not affect diagnostics in different files', () => {
    const diags = [
      makeDiag({ location: { file: 'other.yaml', line: 5, column: 1 } }),
    ];
    const directives = [
      { file: 'test.yaml', line: 1, type: 'disable' as const, ruleId: 'test/rule' },
    ];
    expect(filterByDirectives(diags, directives)).toHaveLength(1);
  });
});
