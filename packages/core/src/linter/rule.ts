import type { ContextGraph, Diagnostic, Severity } from '../types/index.js';

export type RuleTier = 'bronze' | 'silver' | 'gold';

export interface LintRule {
  id: string;
  defaultSeverity: Severity;
  description: string;
  fixable: boolean;
  tier?: RuleTier;
  docUrl?: string;
  deprecated?: boolean;
  replacedBy?: string;
  run(graph: ContextGraph): Diagnostic[];
}
