import { describe, it, expect } from 'vitest';
import { formatJUnit } from '../formatters/junit.js';
import type { Diagnostic } from '@runcontext/core';

const makeDiag = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  ruleId: 'test/rule',
  severity: 'warning',
  message: 'Test message',
  location: { file: 'context/models/test.model.yaml', line: 5, column: 1 },
  fixable: false,
  ...overrides,
});

describe('formatJUnit', () => {
  it('produces valid XML structure', () => {
    const output = formatJUnit([makeDiag()]);

    expect(output).toContain('<?xml version="1.0"');
    expect(output).toContain('<testsuites');
    expect(output).toContain('</testsuites>');
  });

  it('groups diagnostics by file as testsuites', () => {
    const diags = [
      makeDiag({ location: { file: 'file-a.yaml', line: 1, column: 1 } }),
      makeDiag({ location: { file: 'file-a.yaml', line: 2, column: 1 } }),
      makeDiag({ location: { file: 'file-b.yaml', line: 1, column: 1 } }),
    ];
    const output = formatJUnit(diags);

    expect(output).toContain('name="file-a.yaml"');
    expect(output).toContain('name="file-b.yaml"');
    // 2 testsuites
    const suiteMatches = output.match(/<testsuite /g);
    expect(suiteMatches).toHaveLength(2);
  });

  it('includes failure details', () => {
    const output = formatJUnit([
      makeDiag({ ruleId: 'my/rule', message: 'Something broke', severity: 'error' }),
    ]);

    expect(output).toContain('type="error"');
    expect(output).toContain('Something broke');
    expect(output).toContain('my/rule');
  });

  it('escapes XML special characters', () => {
    const output = formatJUnit([
      makeDiag({ message: 'Value <foo> & "bar"' }),
    ]);

    expect(output).toContain('&lt;foo&gt;');
    expect(output).toContain('&amp;');
    expect(output).toContain('&quot;bar&quot;');
  });

  it('shows correct test counts', () => {
    const diags = [makeDiag(), makeDiag()];
    const output = formatJUnit(diags);

    expect(output).toContain('tests="2"');
    expect(output).toContain('failures="2"');
  });
});
