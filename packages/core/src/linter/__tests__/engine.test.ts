import { describe, it, expect } from 'vitest';
import type { ContextGraph, Diagnostic, Severity } from '../../types/index.js';
import type { LintRule } from '../rule.js';
import { LintEngine } from '../engine.js';
import { createEmptyGraph } from '../../compiler/graph.js';

function makeRule(
  id: string,
  defaultSeverity: Severity,
  diagnostics: Diagnostic[],
): LintRule {
  return {
    id,
    defaultSeverity,
    description: `Test rule ${id}`,
    fixable: false,
    run: () => diagnostics,
  };
}

function makeDiag(
  ruleId: string,
  file: string,
  line: number,
): Diagnostic {
  return {
    ruleId,
    severity: 'warning',
    message: `${ruleId} failed`,
    location: { file, line, column: 1 },
    fixable: false,
  };
}

describe('LintEngine', () => {
  it('registers and runs rules', () => {
    const engine = new LintEngine();
    const rule = makeRule('test/rule', 'warning', [
      makeDiag('test/rule', 'a.yaml', 1),
    ]);
    engine.register(rule);
    const graph = createEmptyGraph();
    const results = engine.run(graph);
    expect(results).toHaveLength(1);
    expect(results[0]!.ruleId).toBe('test/rule');
  });

  it('runs multiple registered rules', () => {
    const engine = new LintEngine();
    engine.register(makeRule('rule-a', 'warning', [makeDiag('rule-a', 'a.yaml', 1)]));
    engine.register(makeRule('rule-b', 'error', [makeDiag('rule-b', 'b.yaml', 1)]));
    const results = engine.run(createEmptyGraph());
    expect(results).toHaveLength(2);
  });

  it('severity overrides change diagnostic severity', () => {
    const engine = new LintEngine({ 'test/rule': 'error' });
    const rule = makeRule('test/rule', 'warning', [
      makeDiag('test/rule', 'a.yaml', 1),
    ]);
    engine.register(rule);
    const results = engine.run(createEmptyGraph());
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe('error');
  });

  it('"off" override disables rule entirely', () => {
    const engine = new LintEngine({ 'test/rule': 'off' });
    const rule = makeRule('test/rule', 'warning', [
      makeDiag('test/rule', 'a.yaml', 1),
    ]);
    engine.register(rule);
    const results = engine.run(createEmptyGraph());
    expect(results).toHaveLength(0);
  });

  it('rules without override use defaultSeverity', () => {
    const engine = new LintEngine();
    const rule = makeRule('test/rule', 'error', [
      makeDiag('test/rule', 'a.yaml', 1),
    ]);
    engine.register(rule);
    const results = engine.run(createEmptyGraph());
    expect(results[0]!.severity).toBe('error');
  });

  it('results are sorted by file then line', () => {
    const engine = new LintEngine();
    engine.register(
      makeRule('rule-a', 'warning', [
        makeDiag('rule-a', 'z.yaml', 10),
        makeDiag('rule-a', 'a.yaml', 5),
      ]),
    );
    engine.register(
      makeRule('rule-b', 'warning', [
        makeDiag('rule-b', 'a.yaml', 1),
        makeDiag('rule-b', 'z.yaml', 3),
      ]),
    );
    const results = engine.run(createEmptyGraph());
    expect(results).toHaveLength(4);
    expect(results[0]!.location.file).toBe('a.yaml');
    expect(results[0]!.location.line).toBe(1);
    expect(results[1]!.location.file).toBe('a.yaml');
    expect(results[1]!.location.line).toBe(5);
    expect(results[2]!.location.file).toBe('z.yaml');
    expect(results[2]!.location.line).toBe(3);
    expect(results[3]!.location.file).toBe('z.yaml');
    expect(results[3]!.location.line).toBe(10);
  });

  it('returns empty array when no rules registered', () => {
    const engine = new LintEngine();
    const results = engine.run(createEmptyGraph());
    expect(results).toHaveLength(0);
  });

  it('returns empty array when all rules produce no diagnostics', () => {
    const engine = new LintEngine();
    engine.register(makeRule('clean-rule', 'warning', []));
    const results = engine.run(createEmptyGraph());
    expect(results).toHaveLength(0);
  });

  it('override applies only to matching rule id', () => {
    const engine = new LintEngine({ 'rule-a': 'off' });
    engine.register(makeRule('rule-a', 'warning', [makeDiag('rule-a', 'a.yaml', 1)]));
    engine.register(makeRule('rule-b', 'error', [makeDiag('rule-b', 'b.yaml', 1)]));
    const results = engine.run(createEmptyGraph());
    expect(results).toHaveLength(1);
    expect(results[0]!.ruleId).toBe('rule-b');
  });

  it('multiple diagnostics from one rule all get severity override', () => {
    const engine = new LintEngine({ 'test/rule': 'error' });
    engine.register(
      makeRule('test/rule', 'warning', [
        makeDiag('test/rule', 'a.yaml', 1),
        makeDiag('test/rule', 'b.yaml', 2),
      ]),
    );
    const results = engine.run(createEmptyGraph());
    expect(results).toHaveLength(2);
    expect(results.every((d) => d.severity === 'error')).toBe(true);
  });
});
