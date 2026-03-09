import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';
import type { RunContextConfig } from '../types/config.js';

/**
 * Deep-merge two config objects. Right-side wins on conflicts.
 * Arrays are replaced (not concatenated) — matches ESLint behavior.
 */
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overVal = override[key];

    if (
      baseVal &&
      overVal &&
      typeof baseVal === 'object' &&
      typeof overVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      );
    } else {
      result[key] = overVal;
    }
  }

  return result;
}

/**
 * Resolve a single extends reference.
 * - If it starts with `.` or `/`, treat as a local file path (YAML)
 * - Otherwise, treat as an npm package name and import() it
 */
async function resolveExtend(
  ref: string,
  rootDir: string,
): Promise<Record<string, unknown>> {
  if (ref.startsWith('.') || ref.startsWith('/')) {
    // Local file
    const filePath = path.resolve(rootDir, ref);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.parse(raw);
    return (parsed ?? {}) as Record<string, unknown>;
  }

  // npm package — must export a default config object
  try {
    const mod = await import(ref);
    return (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Failed to resolve extends "${ref}". Make sure the package is installed.`,
    );
  }
}

/**
 * Resolve the `extends` chain in a RunContext config.
 *
 * Configs are merged left to right: first extends entry is the base,
 * each subsequent entry overrides it, and the user's own config wins last.
 */
export async function resolveExtends(
  config: Record<string, unknown>,
  rootDir: string,
): Promise<Partial<RunContextConfig>> {
  const extendsRefs = config.extends as string[] | undefined;

  if (!extendsRefs || extendsRefs.length === 0) {
    return config as Partial<RunContextConfig>;
  }

  // Resolve all extended configs
  let merged: Record<string, unknown> = {};
  for (const ref of extendsRefs) {
    const extended = await resolveExtend(ref, rootDir);
    merged = deepMerge(merged, extended);
  }

  // User config wins last (strip extends to avoid recursion)
  const { extends: _extends, ...userConfig } = config;
  merged = deepMerge(merged, userConfig);

  return merged as Partial<RunContextConfig>;
}
