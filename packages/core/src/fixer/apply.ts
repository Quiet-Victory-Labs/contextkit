import type { Diagnostic, TextEdit } from '../types/index.js';

/**
 * Apply auto-fixes from diagnostics, returning a map of file path to new content.
 *
 * Edits are grouped by file, sorted in reverse order (bottom-to-top, right-to-left),
 * and applied sequentially so that earlier positions remain stable.
 */
export function applyFixes(
  diagnostics: Diagnostic[],
  readFile: (path: string) => string,
): Map<string, string> {
  // Collect all edits grouped by file
  const editsByFile = new Map<string, TextEdit[]>();

  for (const diag of diagnostics) {
    if (!diag.fixable || !diag.fix) continue;

    const file = diag.location.file;
    if (!editsByFile.has(file)) {
      editsByFile.set(file, []);
    }
    const fileEdits = editsByFile.get(file)!;
    for (const edit of diag.fix.edits) {
      fileEdits.push(edit);
    }
  }

  // Apply edits per file
  const result = new Map<string, string>();

  for (const [file, edits] of editsByFile) {
    // Sort edits in reverse order: by startLine descending, then startCol descending.
    // This ensures bottom-to-top, right-to-left application so earlier positions stay valid.
    edits.sort((a, b) => {
      if (a.startLine !== b.startLine) return b.startLine - a.startLine;
      return b.startCol - a.startCol;
    });

    const content = readFile(file);
    const lines = content.split('\n');

    for (const edit of edits) {
      applyEdit(lines, edit);
    }

    result.set(file, lines.join('\n'));
  }

  return result;
}

/**
 * Apply a single TextEdit to an array of lines (mutates in place).
 * Lines and columns are 1-indexed.
 */
function applyEdit(lines: string[], edit: TextEdit): void {
  const { startLine, startCol, endLine, endCol, newText } = edit;

  // Convert to 0-indexed
  const sl = startLine - 1;
  const el = endLine - 1;

  // Build the new content: prefix of start line + newText + suffix of end line
  const prefix = lines[sl]!.slice(0, startCol - 1);
  const suffix = lines[el]!.slice(endCol - 1);
  const replacement = prefix + newText + suffix;

  // Replace the affected line range with the replacement (which may contain newlines)
  const newLines = replacement.split('\n');
  lines.splice(sl, el - sl + 1, ...newLines);
}
