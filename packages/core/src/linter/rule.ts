import type { ContextGraph, Diagnostic, Severity } from '../types/index.js';

export interface LintRule {
  id: string;
  defaultSeverity: Severity;
  description: string;
  fixable: boolean;
  run(graph: ContextGraph): Diagnostic[];
}
