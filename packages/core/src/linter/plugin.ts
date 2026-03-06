import type { LintRule } from './rule.js';

export interface ContextKitPlugin {
  name: string;
  rules: LintRule[];
}

/**
 * Load plugins by name and return their rules.
 *
 * Plugin names are resolved as npm packages via dynamic import().
 * Each plugin must export a default ContextKitPlugin object or
 * an object with a `rules` array.
 */
export async function loadPlugins(pluginNames: string[]): Promise<LintRule[]> {
  const rules: LintRule[] = [];

  for (const name of pluginNames) {
    try {
      const mod = await import(name);
      const plugin = (mod.default ?? mod) as ContextKitPlugin;

      if (!plugin.rules || !Array.isArray(plugin.rules)) {
        throw new Error(`Plugin "${name}" does not export a valid rules array.`);
      }

      rules.push(...plugin.rules);
    } catch (err) {
      if ((err as Error).message?.includes('does not export')) {
        throw err;
      }
      throw new Error(
        `Failed to load plugin "${name}". Make sure it is installed: ${(err as Error).message}`,
      );
    }
  }

  return rules;
}
