import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ContextKitConfig } from '../types/index.js';
import { DEFAULT_CONFIG } from './defaults.js';

/**
 * Deep-merge a partial config with another object (typically defaults).
 * Arrays are replaced, not merged. Nested objects are recursively merged.
 */
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>,
): T {
  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];

    if (
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      result[key] = overrideVal;
    }
  }

  return result as T;
}

/**
 * Merge a partial user config with the defaults, returning a complete config.
 * Nested objects are deep-merged; arrays and primitives are overwritten.
 */
export function resolveConfig(
  partial: Partial<ContextKitConfig>,
): ContextKitConfig {
  return deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    partial as unknown as Record<string, unknown>,
  ) as unknown as ContextKitConfig;
}

/** Config file names tried in order of priority. */
const CONFIG_FILENAMES = [
  'contextkit.config.ts',
  'contextkit.config.js',
  'contextkit.config.yaml',
  'contextkit.config.yml',
] as const;

/**
 * Load a ContextKit config from the given root directory.
 *
 * Searches for config files in this order:
 *   1. contextkit.config.ts
 *   2. contextkit.config.js
 *   3. contextkit.config.yaml
 *   4. contextkit.config.yml
 *
 * Falls back to DEFAULT_CONFIG if no config file is found.
 */
export async function loadConfig(
  rootDir: string = '.',
): Promise<ContextKitConfig> {
  const absRoot = resolve(rootDir);

  for (const filename of CONFIG_FILENAMES) {
    const filepath = join(absRoot, filename);

    if (!existsSync(filepath)) {
      continue;
    }

    if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
      const raw = readFileSync(filepath, 'utf-8');
      const parsed = parseYaml(raw) as Partial<ContextKitConfig>;
      return resolveConfig(parsed ?? {});
    }

    // TS / JS config — use dynamic import
    if (filename.endsWith('.ts') || filename.endsWith('.js')) {
      const mod = (await import(filepath)) as {
        default?: Partial<ContextKitConfig>;
      };
      const partial = mod.default ?? (mod as unknown as Partial<ContextKitConfig>);
      return resolveConfig(partial);
    }
  }

  // No config file found — return defaults
  return { ...DEFAULT_CONFIG };
}
