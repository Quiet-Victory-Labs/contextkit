import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { runContextConfigSchema } from '../schema/config.js';
import type { RunContextConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { resolveExtends } from './resolve-extends.js';

const CONFIG_FILENAME = 'runcontext.config.yaml';
const LEGACY_CONFIG_FILENAME = 'contextkit.config.yaml';

/**
 * Resolve the config file path, preferring `runcontext.config.yaml` but
 * falling back to legacy `contextkit.config.yaml` for backward compatibility.
 */
function resolveConfigPath(rootDir: string): string | null {
  const preferred = path.join(rootDir, CONFIG_FILENAME);
  if (fs.existsSync(preferred)) return preferred;

  const legacy = path.join(rootDir, LEGACY_CONFIG_FILENAME);
  if (fs.existsSync(legacy)) return legacy;

  return null;
}

/**
 * Load the RunContext configuration from a root directory (sync).
 *
 * Reads `runcontext.config.yaml` (or legacy `contextkit.config.yaml`) from
 * `rootDir`, parses YAML, validates via the Zod config schema, and merges
 * with defaults. Returns `DEFAULT_CONFIG` when no config file is found.
 *
 * Note: Does NOT resolve `extends`. Use `loadConfigAsync` for full resolution.
 */
export function loadConfig(rootDir: string): RunContextConfig {
  const configPath = resolveConfigPath(rootDir);

  if (!configPath) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = yaml.parse(raw);

  // Empty file or YAML that parses to null/undefined
  if (parsed == null) {
    return { ...DEFAULT_CONFIG };
  }

  // Validate with Zod — .parse() will throw on invalid data.
  // The schema has .default() on context_dir and output_dir, so
  // partial configs get those filled in automatically.
  const validated = runContextConfigSchema.parse(parsed);

  return validated as RunContextConfig;
}

/**
 * Load the RunContext configuration with full `extends` resolution.
 *
 * Same as `loadConfig` but resolves the `extends` chain (local files and
 * npm packages) before validation.
 */
export async function loadConfigAsync(rootDir: string): Promise<RunContextConfig> {
  const configPath = resolveConfigPath(rootDir);

  if (!configPath) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = yaml.parse(raw);

  if (parsed == null) {
    return { ...DEFAULT_CONFIG };
  }

  // Resolve extends chain before validation
  const resolved = await resolveExtends(parsed as Record<string, unknown>, rootDir);

  const validated = runContextConfigSchema.parse(resolved);
  return validated as RunContextConfig;
}
