import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import {
  loadConfig,
  compile,
  emitManifest,
  LintEngine,
  ALL_RULES,
} from '@contextkit/core';
import type { Diagnostic, Severity } from '@contextkit/core';
import { formatDiagnostics } from '../formatters/pretty.js';
import { formatDiagnosticsJson } from '../formatters/json.js';

export const buildCommand = new Command('build')
  .description('Compile context files and emit manifest')
  .option('--format <format>', 'output format for diagnostics (pretty|json)', 'pretty')
  .action(async (opts: { format: string }) => {
    try {
      const config = await loadConfig(process.cwd());

      const rootDir = config.paths?.rootDir || process.cwd();
      const contextDir = path.resolve(rootDir, config.paths?.contextDir || 'context');
      const distDir = path.resolve(rootDir, config.paths?.distDir || 'dist');

      // Compile context files
      const { graph, diagnostics: compileDiags } = await compile({ contextDir, config });

      // Run lint engine
      const engine = new LintEngine(config.lint?.rules as Record<string, Severity | 'off'> | undefined);
      for (const rule of ALL_RULES) {
        engine.register(rule);
      }
      const lintDiags = engine.run(graph);

      // Merge diagnostics
      const allDiags: Diagnostic[] = [...compileDiags, ...lintDiags];

      // Display diagnostics
      if (allDiags.length > 0) {
        const output =
          opts.format === 'json'
            ? formatDiagnosticsJson(allDiags)
            : formatDiagnostics(allDiags);
        console.error(output);
      }

      // Emit manifest
      const manifest = emitManifest(graph, config);

      // Ensure dist directory exists
      fs.mkdirSync(distDir, { recursive: true });

      const manifestPath = path.join(distDir, 'context.manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      // Print summary
      const summary = [
        `Built manifest: ${manifest.concepts.length} concepts`,
        `${manifest.products.length} products`,
        `${manifest.policies.length} policies`,
        `${manifest.entities.length} entities`,
        `${manifest.terms.length} terms`,
        `${manifest.owners.length} owners`,
      ].join(', ');
      console.log(summary);
      console.log(`Manifest written to ${manifestPath}`);

      // Exit with error if any errors found
      const hasErrors = allDiags.some((d) => d.severity === 'error');
      if (hasErrors) {
        process.exit(1);
      }
    } catch (err) {
      console.error('Build failed:', (err as Error).message);
      process.exit(1);
    }
  });
