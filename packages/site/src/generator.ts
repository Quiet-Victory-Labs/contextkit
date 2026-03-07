/**
 * Site generator for ContextKit.
 *
 * `generateSite` accepts a Manifest and returns a Map of relative file path
 * to HTML content. The caller is responsible for writing files to disk.
 *
 * `buildSite` is a convenience function used by the CLI that compiles context,
 * generates the site, and writes files to the output directory.
 */

import ejs from 'ejs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Manifest, SiteConfig, ContextKitConfig } from '@runcontext/core';
import {
  indexTemplate,
  modelTemplate,
  schemaTemplate,
  rulesTemplate,
  glossaryTemplate,
  ownerTemplate,
  searchTemplate,
} from './templates.js';
import { buildSearchIndex } from './search/build-index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateSiteOptions {
  manifest: Manifest;
  config?: SiteConfig;
}

// ---------------------------------------------------------------------------
// generateSite — pure function returning Map<path, html>
// ---------------------------------------------------------------------------

/**
 * Generate all HTML pages for the documentation site.
 *
 * @param manifest - The compiled ContextKit manifest
 * @param config - Optional site configuration (title, base_path)
 * @returns Map of relative file paths to HTML content
 */
export function generateSite(
  manifest: Manifest,
  config?: SiteConfig,
  options?: { studioMode?: boolean },
): Map<string, string> {
  const files = new Map<string, string>();
  const siteTitle = config?.title ?? 'ContextKit';
  const basePath = (config?.base_path ?? '').replace(/\/+$/, '');
  const studioMode = options?.studioMode ?? false;

  // Common data shared across all pages (includes sidebar data)
  const commonData = {
    siteTitle,
    basePath,
    studioMode,
    models: manifest.models,
    tiers: manifest.tiers,
  };

  // --- Index page ---
  files.set(
    'index.html',
    ejs.render(indexTemplate, {
      ...commonData,
      pageTitle: 'Home',
      governance: manifest.governance,
      owners: manifest.owners,
      terms: manifest.terms,
    }),
  );

  // --- Model pages ---
  for (const [name, model] of Object.entries(manifest.models)) {
    const gov = manifest.governance[name] ?? null;
    const tier = manifest.tiers[name] ?? null;
    const rules = manifest.rules[name] ?? null;
    const lineage = manifest.lineage[name] ?? null;

    // Main model page
    files.set(
      `models/${name}.html`,
      ejs.render(modelTemplate, {
        ...commonData,
        pageTitle: name,
        model,
        gov,
        tier,
        rules,
        lineage,
      }),
    );

    // Schema browser page
    files.set(
      `models/${name}/schema.html`,
      ejs.render(schemaTemplate, {
        ...commonData,
        pageTitle: `${name} — Schema`,
        model,
        gov,
        tier,
      }),
    );

    // Rules page
    files.set(
      `models/${name}/rules.html`,
      ejs.render(rulesTemplate, {
        ...commonData,
        pageTitle: `${name} — Rules`,
        modelName: name,
        rules,
      }),
    );
  }

  // --- Glossary page ---
  files.set(
    'glossary.html',
    ejs.render(glossaryTemplate, {
      ...commonData,
      pageTitle: 'Glossary',
      terms: manifest.terms,
    }),
  );

  // --- Owner pages ---
  for (const [oid, owner] of Object.entries(manifest.owners)) {
    // Find models governed by this owner
    const governedModels: Array<{ name: string; tier: string | null }> = [];
    for (const [modelName, gov] of Object.entries(manifest.governance)) {
      if (gov.owner === oid) {
        const tierScore = manifest.tiers[modelName];
        governedModels.push({
          name: modelName,
          tier: tierScore?.tier ?? null,
        });
      }
    }

    files.set(
      `owners/${oid}.html`,
      ejs.render(ownerTemplate, {
        ...commonData,
        pageTitle: owner.display_name,
        owner,
        governedModels,
      }),
    );
  }

  // --- Search page ---
  const searchIndex = buildSearchIndex(manifest, basePath);
  files.set(
    'search.html',
    ejs.render(searchTemplate, {
      ...commonData,
      pageTitle: 'Search',
      searchIndexJson: JSON.stringify(searchIndex),
    }),
  );

  // --- Search index JSON (for programmatic access) ---
  files.set('search-index.json', JSON.stringify(searchIndex, null, 2));

  return files;
}

// ---------------------------------------------------------------------------
// buildSite — convenience function used by CLI
// ---------------------------------------------------------------------------

/**
 * Build the documentation site and write files to disk.
 *
 * Called by the CLI `site` command. Accepts a manifest, config, and output
 * directory, then generates and writes all site files.
 *
 * @param manifest - The compiled ContextKit manifest
 * @param config - The full ContextKit configuration
 * @param outputDir - Directory to write site files to
 */
export async function buildSite(
  manifest: Manifest,
  config: ContextKitConfig,
  outputDir: string,
): Promise<void> {
  const siteConfig = config.site;
  const files = generateSite(manifest, siteConfig);

  for (const [filePath, content] of files) {
    const fullPath = path.join(outputDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// buildAstroSite — Astro-based site builder
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

/**
 * Build the site using Astro.
 *
 * Writes the manifest data to the Astro project's data directory,
 * then runs `astro build` to generate static files.
 */
export async function buildAstroSite(
  manifest: Manifest,
  config: ContextKitConfig,
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
      title: config.site?.title ?? 'ContextKit',
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
