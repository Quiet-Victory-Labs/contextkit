import * as fs from 'node:fs';
import type { TextEdit } from '../types/diagnostics.js';

/**
 * Find the line number of a top-level key in a YAML file.
 * Returns 1-indexed line number, or -1 if not found.
 */
export function findKeyLine(content: string, key: string): number {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    // Match top-level key (no leading whitespace)
    if (line.startsWith(`${key}:`) || line === key + ':') {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Find the last line of a YAML document's content (before any trailing newlines).
 */
function findLastContentLine(content: string): number {
  const lines = content.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = (lines[i] as string).trim();
    if (line !== '') return i + 1;
  }
  return 1;
}

/**
 * Create a TextEdit that inserts a new top-level key-value pair at the end of a YAML file.
 */
export function insertTopLevelKey(
  content: string,
  key: string,
  value: string,
): TextEdit {
  const lastLine = findLastContentLine(content);
  const lines = content.split('\n');
  const lastLineContent = lines[lastLine - 1] as string;
  const lastCol = lastLineContent.length + 1;

  return {
    startLine: lastLine,
    startCol: lastCol,
    endLine: lastLine,
    endCol: lastCol,
    newText: `\n${key}: ${value}`,
  };
}

/**
 * Create a TextEdit that inserts a key-value pair under an existing nested key.
 * `parentKey` is the top-level key, and the new entry is inserted as an indented child.
 */
export function insertNestedKey(
  content: string,
  parentKey: string,
  childKey: string,
  value: string,
  indent: number = 2,
): TextEdit {
  const lines = content.split('\n');
  const parentLine = findKeyLine(content, parentKey);
  if (parentLine === -1) {
    // Fallback: insert at end
    return insertTopLevelKey(content, `${parentKey}`, `\n${' '.repeat(indent)}${childKey}: ${value}`);
  }

  // Find the end of the parent's block (next line at same or less indentation, or EOF)
  let insertAfterLine = parentLine;
  const prefix = ' '.repeat(indent);

  for (let i = parentLine; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.trim() === '') {
      insertAfterLine = i;
      continue;
    }
    // Check if this line is still indented (part of parent's block)
    if (line.startsWith(prefix) || line.startsWith('\t')) {
      insertAfterLine = i + 1;
    } else if (i > parentLine - 1) {
      break;
    }
  }

  const insertLine = insertAfterLine;
  const lineContent = lines[insertLine - 1] as string;
  const lastCol = lineContent.length + 1;

  return {
    startLine: insertLine,
    startCol: lastCol,
    endLine: insertLine,
    endCol: lastCol,
    newText: `\n${prefix}${childKey}: ${value}`,
  };
}

/**
 * Create a TextEdit that replaces the sample_values array for a given field key in a governance YAML file.
 * Uses simple line scanning to find the field's sample_values block and replace it.
 *
 * @param content - Raw YAML file content
 * @param fieldKey - The field key in the governance fields map, e.g. "yelp_reviews.stars"
 * @param newValues - Replacement string values for the array
 * @returns TextEdit or null if the sample_values block was not found
 */
export function replaceSampleValues(
  content: string,
  fieldKey: string,
  newValues: string[],
): TextEdit | null {
  const lines = content.split('\n');

  // 1. Find the field key line (indented under "fields:")
  //    Pattern: "  fieldKey:" with some leading whitespace
  let fieldLineIdx = -1;
  const escapedKey = fieldKey.replace(/\./g, '\\.');
  const fieldPattern = new RegExp(`^(\\s+)${escapedKey.replace(/\\\./g, '\\.')}\\s*:`);
  for (let i = 0; i < lines.length; i++) {
    // Match the literal field key (dots are literal in YAML keys)
    const line = lines[i] as string;
    const trimmed = line.trimStart();
    if (trimmed.startsWith(fieldKey + ':') || trimmed === fieldKey + ':') {
      fieldLineIdx = i;
      break;
    }
  }
  if (fieldLineIdx === -1) return null;

  // 2. Determine the field's indentation level
  const fieldLine = lines[fieldLineIdx] as string;
  const fieldIndent = fieldLine.length - fieldLine.trimStart().length;

  // 3. Find "sample_values:" under this field
  let svLineIdx = -1;
  const childIndent = fieldIndent + 2;
  for (let i = fieldLineIdx + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    const trimmed = line.trimStart();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const lineIndent = line.length - trimmed.length;
    // If we've exited the field's block, stop
    if (lineIndent <= fieldIndent && trimmed !== '') break;
    if (lineIndent === childIndent && trimmed.startsWith('sample_values:')) {
      svLineIdx = i;
      break;
    }
  }
  if (svLineIdx === -1) return null;

  // 4. Find the extent of the sample_values array items (lines starting with "- ")
  const itemIndent = childIndent + 2;
  let lastItemIdx = svLineIdx;
  for (let i = svLineIdx + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    const trimmed = line.trimStart();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const lineIndent = line.length - trimmed.length;
    if (lineIndent >= itemIndent && trimmed.startsWith('- ')) {
      lastItemIdx = i;
    } else {
      break;
    }
  }

  // 5. Build the replacement: "sample_values:" line + new items
  const pad = ' '.repeat(childIndent);
  const itemPad = ' '.repeat(itemIndent);
  const newLines = [`${pad}sample_values:`];
  for (const v of newValues) {
    newLines.push(`${itemPad}- "${v}"`);
  }

  // 6. Create TextEdit replacing from sample_values: line through last item
  return {
    startLine: svLineIdx + 1,
    startCol: 1,
    endLine: lastItemIdx + 1,
    endCol: (lines[lastItemIdx] as string).length + 1,
    newText: newLines.join('\n'),
  };
}

/**
 * Read file content from disk, with caching per invocation.
 */
export function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}
