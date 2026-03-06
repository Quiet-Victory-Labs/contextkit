import { describe, it, expect } from 'vitest';
import { formatGitHub } from '../formatters/github.js';
import type { Diagnostic } from '@runcontext/core';

const makeDiag = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  ruleId: 'test/rule',
  severity: 'warning',
  message: 'Test message',
  location: { file: 'context/models/test.model.yaml', line: 5, column: 1 },
  fixable: false,
  ...overrides,
});

describe('formatGitHub', () => {
  it('formats warnings as ::warning annotations', () => {
    const output = formatGitHub([makeDiag()]);

    expect(output).toBe(
      '::warning file=context/models/test.model.yaml,line=5,col=1,title=test/rule::Test message',
    );
  });

  it('formats errors as ::error annotations', () => {
    const output = formatGitHub([makeDiag({ severity: 'error' })]);

    expect(output).toContain('::error file=');
  });

  it('outputs one line per diagnostic', () => {
    const diags = [
      makeDiag({ ruleId: 'a/rule' }),
      makeDiag({ ruleId: 'b/rule' }),
      makeDiag({ ruleId: 'c/rule' }),
    ];
    const output = formatGitHub(diags);
    const lines = output.split('\n');

    expect(lines).toHaveLength(3);
  });

  it('returns empty string for no diagnostics', () => {
    expect(formatGitHub([])).toBe('');
  });
});
