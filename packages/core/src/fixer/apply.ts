import fs from 'node:fs';
import type { Diagnostic, TextEdit } from '../types/index.js';

export interface ApplyResult {
  file: string;
  editsApplied: number;
  newContent: string;
}

/**
 * Apply fixable diagnostics to produce new file contents.
 *
 * Filters diagnostics to those with `fixable: true` and a `fix` property,
 * groups their edits by file, then applies edits in reverse line order
 * (bottom-to-top) to avoid offset corruption.
 *
 * Currently handles insertion edits where startLine === endLine and
 * startCol === endCol.
 */
export function applyFixes(diagnostics: Diagnostic[]): ApplyResult[] {
  // 1. Collect all edits from fixable diagnostics, grouped by file
  const editsByFile = new Map<string, TextEdit[]>();

  for (const diag of diagnostics) {
    if (!diag.fixable || !diag.fix) continue;

    for (const edit of diag.fix.edits) {
      const existing = editsByFile.get(edit.file);
      if (existing) {
        existing.push(edit);
      } else {
        editsByFile.set(edit.file, [edit]);
      }
    }
  }

  // 2. For each file, read content, apply edits in reverse order, produce result
  const results: ApplyResult[] = [];

  for (const [file, edits] of editsByFile) {
    // Sort edits in reverse order (bottom-to-top by startLine, then startCol)
    const sorted = [...edits].sort((a, b) => {
      if (b.range.startLine !== a.range.startLine) {
        return b.range.startLine - a.range.startLine;
      }
      return b.range.startCol - a.range.startCol;
    });

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      // File not readable — skip
      continue;
    }

    const lines = content.split('\n');

    for (const edit of sorted) {
      const { startLine, startCol, endLine, endCol } = edit.range;

      if (startLine === endLine && startCol === endCol) {
        // Insertion edit: insert newText at the given position
        // Lines are 1-indexed in diagnostics
        const lineIdx = startLine - 1;
        if (lineIdx >= 0 && lineIdx <= lines.length) {
          if (lineIdx === lines.length) {
            // Insert at the end of the file
            lines.push(edit.newText.replace(/\n$/, ''));
          } else {
            const line = lines[lineIdx] ?? '';
            const colIdx = startCol - 1;
            const before = line.slice(0, colIdx);
            const after = line.slice(colIdx);
            // newText may contain newlines — split and splice
            const insertLines = (before + edit.newText + after).split('\n');
            lines.splice(lineIdx, 1, ...insertLines);
          }
        }
      } else {
        // Range replacement edit
        const startLineIdx = startLine - 1;
        const endLineIdx = endLine - 1;
        if (startLineIdx >= 0 && endLineIdx < lines.length) {
          const beforeText = (lines[startLineIdx] ?? '').slice(0, startCol - 1);
          const afterText = (lines[endLineIdx] ?? '').slice(endCol - 1);
          const replacementLines = (beforeText + edit.newText + afterText).split('\n');
          lines.splice(startLineIdx, endLineIdx - startLineIdx + 1, ...replacementLines);
        }
      }
    }

    results.push({
      file,
      editsApplied: edits.length,
      newContent: lines.join('\n'),
    });
  }

  return results;
}
