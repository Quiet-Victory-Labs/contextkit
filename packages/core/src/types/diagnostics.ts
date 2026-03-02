import type { Severity, SourceLocation } from './nodes.js';

export interface TextEdit {
  file: string;
  range: { startLine: number; startCol: number; endLine: number; endCol: number };
  newText: string;
}

export interface Fix {
  description: string;
  edits: TextEdit[];
}

export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  source: SourceLocation;
  fixable: boolean;
  fix?: Fix;
  suggestions?: string[];
}
