import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { contextKitConfigSchema } from '../schema/config.js';
import type { ContextKitConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from './defaults.js';

const CONFIG_FILENAME = 'contextkit.config.yaml';

/**
 * Load the ContextKit configuration from a root directory.
 *
 * Reads `contextkit.config.yaml` from `rootDir`, parses YAML, validates via
 * the Zod config schema, and merges with defaults. Returns `DEFAULT_CONFIG`
 * when no config file is found.
 */
export function loadConfig(rootDir: string): ContextKitConfig {
  const configPath = path.join(rootDir, CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
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
  const validated = contextKitConfigSchema.parse(parsed);

  return validated as ContextKitConfig;
}
