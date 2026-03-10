/**
 * Site generator for RunContext.
 *
 * Uses Astro to build a static documentation site from compiled context.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Manifest, RunContextConfig } from '@runcontext/core';

// ---------------------------------------------------------------------------
// getAstroProjectDir
// ---------------------------------------------------------------------------

/**
 * Resolve the path to the Astro project template.
 * Works both in source (development) and from the published npm package.
 */
export function getAstroProjectDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFile);
  // From dist/: ../astro  |  From src/: ../astro
  const astroDir = path.resolve(thisDir, '..', 'astro');
  if (fs.existsSync(astroDir)) return astroDir;
  // Fallback: look in package root
  const pkgRoot = path.resolve(thisDir, '..', '..');
  return path.join(pkgRoot, 'astro');
}

// ---------------------------------------------------------------------------
// buildSite — Astro-based site builder
// ---------------------------------------------------------------------------

/**
 * Build the site using Astro.
 *
 * Writes the manifest data to the Astro project's data directory,
 * then runs `astro build` to generate static files.
 */
export async function buildSite(
  manifest: Manifest,
  config: RunContextConfig,
  outputDir: string,
): Promise<void> {
  const astroDir = getAstroProjectDir();
  const dataDir = path.join(astroDir, 'src', 'data');

  // Write manifest data for Astro pages to consume
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(dataDir, 'site-config.json'),
    JSON.stringify({
      title: config.site?.title ?? 'RunContext',
      studioMode: false,
    }),
    'utf-8',
  );

  // Also write search index
  const { buildSearchIndex } = await import('./search/build-index.js');
  const searchIndex = buildSearchIndex(manifest, '');
  fs.writeFileSync(
    path.join(astroDir, 'public', 'search-index.json'),
    JSON.stringify(searchIndex, null, 2),
    'utf-8',
  );

  // Run Astro build
  const { execFileSync } = await import('node:child_process');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npx, ['astro', 'build', '--outDir', path.resolve(outputDir)], {
    cwd: astroDir,
    stdio: 'inherit',
  });
}
