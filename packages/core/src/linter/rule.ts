import type { Severity, ContextGraph, Diagnostic } from '../types/index.js';

/**
 * A lint rule that inspects the ContextGraph and returns diagnostics.
 *
 * Rules are ESLint-inspired: each has an id, a default severity,
 * and a `run` method that receives the full graph IR.
 */
export interface LintRule {
  /** Unique rule identifier, e.g. `"naming/id-kebab-case"`. */
  id: string;

  /** Severity when no config override is provided. */
  defaultSeverity: Severity;

  /** Human-readable description of what this rule checks. */
  description: string;

  /** Whether the rule can supply an auto-fix. */
  fixable: boolean;

  /** Inspect the graph and return zero or more diagnostics. */
  run(graph: ContextGraph): Diagnostic[];
}
