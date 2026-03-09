import { describe, it, expect } from 'vitest';
import { formatSarif } from '../formatters/sarif.js';
import type { Diagnostic } from '@runcontext/core';

const makeDiag = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  ruleId: 'test/rule',
  severity: 'warning',
  message: 'Test message',
  location: { file: 'context/models/test.model.yaml', line: 5, column: 1 },
  fixable: false,
  ...overrides,
});

describe('formatSarif', () => {
  it('produces valid SARIF v2.1.0 structure', () => {
    const result = JSON.parse(formatSarif([makeDiag()]));

    expect(result.version).toBe('2.1.0');
    expect(result.$schema).toContain('sarif-schema-2.1.0');
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].tool.driver.name).toBe('RunContext');
  });

  it('maps diagnostics to results', () => {
    const diags = [
      makeDiag({ ruleId: 'a/rule', severity: 'error', message: 'Error msg' }),
      makeDiag({ ruleId: 'b/rule', severity: 'warning', message: 'Warn msg' }),
    ];
    const result = JSON.parse(formatSarif(diags));

    expect(result.runs[0].results).toHaveLength(2);
    expect(result.runs[0].results[0].ruleId).toBe('a/rule');
    expect(result.runs[0].results[0].level).toBe('error');
    expect(result.runs[0].results[1].level).toBe('warning');
  });

  it('collects unique rules in tool.driver.rules', () => {
    const diags = [
      makeDiag({ ruleId: 'same/rule' }),
      makeDiag({ ruleId: 'same/rule' }),
      makeDiag({ ruleId: 'other/rule' }),
    ];
    const result = JSON.parse(formatSarif(diags));

    expect(result.runs[0].tool.driver.rules).toHaveLength(2);
    expect(result.runs[0].tool.driver.rules.map((r: { id: string }) => r.id)).toEqual([
      'same/rule',
      'other/rule',
    ]);
  });

  it('includes location data', () => {
    const result = JSON.parse(formatSarif([makeDiag()]));
    const loc = result.runs[0].results[0].locations[0].physicalLocation;

    expect(loc.artifactLocation.uri).toBe('context/models/test.model.yaml');
    expect(loc.region.startLine).toBe(5);
    expect(loc.region.startColumn).toBe(1);
  });

  it('produces empty results array for no diagnostics', () => {
    const result = JSON.parse(formatSarif([]));

    expect(result.runs[0].results).toHaveLength(0);
    expect(result.runs[0].tool.driver.rules).toHaveLength(0);
  });
});
