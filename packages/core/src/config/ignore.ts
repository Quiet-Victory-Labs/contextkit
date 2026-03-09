import * as fs from 'node:fs';
import * as path from 'node:path';

const IGNORE_FILENAME = '.runcontext-ignore';
const LEGACY_IGNORE_FILENAME = '.contextkit-ignore';

/**
 * Load ignore patterns from .runcontext-ignore (or legacy .contextkit-ignore) file and config.
 * Returns a merged, deduplicated array of glob patterns.
 *
 * .runcontext-ignore format:
 * - One glob per line
 * - Lines starting with # are comments
 * - Empty lines are skipped
 */
export function loadIgnorePatterns(
  rootDir: string,
  configIgnore?: string[],
): string[] {
  const patterns: string[] = [];

  // Load from .runcontext-ignore file (fall back to .contextkit-ignore)
  let ignorePath = path.join(rootDir, IGNORE_FILENAME);
  if (!fs.existsSync(ignorePath)) {
    ignorePath = path.join(rootDir, LEGACY_IGNORE_FILENAME);
  }
  if (fs.existsSync(ignorePath)) {
    const content = fs.readFileSync(ignorePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        patterns.push(trimmed);
      }
    }
  }

  // Merge config ignore patterns
  if (configIgnore) {
    patterns.push(...configIgnore);
  }

  // Deduplicate
  return [...new Set(patterns)];
}
