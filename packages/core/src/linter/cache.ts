import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { Diagnostic } from '../types/diagnostics.js';

const CACHE_FILENAME = '.contextkit-cache';

interface CacheEntry {
  hash: string;
  diagnostics: Diagnostic[];
}

/**
 * Compute a hash of all context files + config for cache key.
 */
export function computeCacheHash(
  contextDir: string,
  configContent: string,
): string {
  const hasher = crypto.createHash('sha256');

  // Hash the config
  hasher.update(configContent);

  // Hash all files in context directory
  if (fs.existsSync(contextDir)) {
    const files = collectFiles(contextDir);
    for (const file of files.sort()) {
      hasher.update(file);
      hasher.update(fs.readFileSync(file));
    }
  }

  return hasher.digest('hex');
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Read cached lint results if they exist and the hash matches.
 */
export function readCache(rootDir: string, hash: string): Diagnostic[] | null {
  const cachePath = path.join(rootDir, CACHE_FILENAME);

  if (!fs.existsSync(cachePath)) return null;

  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const entry = JSON.parse(raw) as CacheEntry;

    if (entry.hash === hash) {
      return entry.diagnostics;
    }
  } catch {
    // Corrupted cache — ignore
  }

  return null;
}

/**
 * Write lint results to cache.
 */
export function writeCache(
  rootDir: string,
  hash: string,
  diagnostics: Diagnostic[],
): void {
  const cachePath = path.join(rootDir, CACHE_FILENAME);
  const entry: CacheEntry = { hash, diagnostics };
  fs.writeFileSync(cachePath, JSON.stringify(entry), 'utf-8');
}
