import * as fs from 'node:fs';
import type { Diagnostic } from '../types/diagnostics.js';

export interface Directive {
  file: string;
  line: number;
  type: 'disable' | 'disable-next-line';
  ruleId?: string; // undefined means all rules
}

// Accept both runcontext-disable and legacy contextkit-disable
const DISABLE_PATTERN = /^\s*#\s*(?:runcontext|contextkit)-disable(?:\s+(.+))?\s*$/;
const DISABLE_NEXT_LINE_PATTERN =
  /^\s*#\s*(?:runcontext|contextkit)-disable-next-line(?:\s+(.+))?\s*$/;

/**
 * Extract RunContext directives from a YAML file's raw content.
 *
 * Supported directives (both `runcontext-` and legacy `contextkit-` prefixes):
 * - `# runcontext-disable rule-id` — disable rule for the rest of the file from that point
 * - `# runcontext-disable-next-line rule-id` — disable rule for the next line only
 * - Without a rule ID, disables all rules
 */
export function extractDirectives(
  filePath: string,
  content?: string,
): Directive[] {
  const raw = content ?? fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');
  const directives: Directive[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;

    const disableNextLine = DISABLE_NEXT_LINE_PATTERN.exec(line);
    if (disableNextLine) {
      const captured = disableNextLine[1] as string | undefined;
      directives.push({
        file: filePath,
        line: i + 1,
        type: 'disable-next-line',
        ruleId: captured?.trim() || undefined,
      });
      continue;
    }

    const disable = DISABLE_PATTERN.exec(line);
    if (disable) {
      const captured = disable[1] as string | undefined;
      directives.push({
        file: filePath,
        line: i + 1,
        type: 'disable',
        ruleId: captured?.trim() || undefined,
      });
    }
  }

  return directives;
}

/**
 * Filter diagnostics by applying inline directives.
 *
 * - `disable` suppresses matching diagnostics from that line onward in the file.
 * - `disable-next-line` suppresses matching diagnostics on the line immediately after.
 */
export function filterByDirectives(
  diagnostics: Diagnostic[],
  directives: Directive[],
): Diagnostic[] {
  if (directives.length === 0) return diagnostics;

  return diagnostics.filter((d) => {
    for (const dir of directives) {
      if (dir.file !== d.location.file) continue;
      if (dir.ruleId && dir.ruleId !== d.ruleId) continue;

      if (dir.type === 'disable-next-line') {
        if (d.location.line === dir.line + 1) return false;
      } else if (dir.type === 'disable') {
        if (d.location.line >= dir.line) return false;
      }
    }
    return true;
  });
}
