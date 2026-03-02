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
): Map<string, string> {
  const files = new Map<string, string>();
  const siteTitle = config?.title ?? 'ContextKit';
  const basePath = (config?.base_path ?? '').replace(/\/+$/, '');

  const commonData = {
    siteTitle,
    basePath,
  };

  // --- Index page ---
  files.set(
    'index.html',
    ejs.render(indexTemplate, {
      ...commonData,
      pageTitle: 'Home',
      models: manifest.models,
      governance: manifest.governance,
      tiers: manifest.tiers,
      owners: manifest.owners,
    }),
  );

  // --- Model pages ---
  for (const [name, model] of Object.entries(manifest.models)) {
    const gov = manifest.governance[name] ?? null;
    const tier = manifest.tiers[name] ?? null;
    const rules = manifest.rules[name] ?? null;

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
