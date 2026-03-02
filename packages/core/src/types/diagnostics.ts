export type Severity = 'error' | 'warning';

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface TextEdit {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
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
  location: SourceLocation;
  fixable: boolean;
  fix?: Fix;
}
