import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import type { Manifest, ManifestConcept } from '@contextkit/core';
import {
  layoutTemplate,
  indexTemplate,
  conceptTemplate,
  productTemplate,
  policyTemplate,
  ownerTemplate,
  glossaryTemplate,
  searchTemplate,
} from './templates.js';
import { buildSearchIndex } from './search/build-index.js';

export interface GenerateSiteOptions {
  manifest: Manifest;
  outputDir: string;
  title?: string;
  basePath?: string;
}

/**
 * Render an EJS content template wrapped in the layout template.
 */
function renderPage(
  contentTemplate: string,
  data: Record<string, unknown>,
  pageTitle: string,
  manifest: Manifest,
  basePath: string,
): string {
  const content = ejs.render(contentTemplate, { ...data, basePath });
  return ejs.render(layoutTemplate, {
    content,
    pageTitle,
    project: manifest.project,
    build: manifest.build,
    basePath,
  });
}

/**
 * Write a file, creating parent directories as needed.
 */
async function writeOutputFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Resolve the path to a bundled asset file (search.js, style.css).
 * These are source assets that ship with the package.
 */
function resolveAssetPath(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  // In development (src/), assets are in src/assets/
  // In built output (dist/), we still try src path first, then fall back
  return join(currentDir, 'assets', filename);
}

/**
 * Generate a static documentation site from a ContextKit manifest.
 *
 * Creates HTML pages for all concepts, products, policies, owners,
 * a glossary page, search page, and index page. Also generates a
 * MiniSearch index for client-side search.
 */
export async function generateSite(options: GenerateSiteOptions): Promise<void> {
  const { manifest, outputDir, title, basePath = '' } = options;
  const projectData = {
    ...manifest.project,
    displayName: title ?? manifest.project.displayName,
  };
  const manifestWithTitle = { ...manifest, project: projectData };

  // Create output directories
  await mkdir(join(outputDir, 'concepts'), { recursive: true });
  await mkdir(join(outputDir, 'products'), { recursive: true });
  await mkdir(join(outputDir, 'policies'), { recursive: true });
  await mkdir(join(outputDir, 'owners'), { recursive: true });

  // Render index page
  const indexHtml = renderPage(
    indexTemplate,
    {
      project: manifestWithTitle.project,
      concepts: manifest.concepts,
      products: manifest.products,
      policies: manifest.policies,
      entities: manifest.entities,
      terms: manifest.terms,
      owners: manifest.owners,
    },
    'Home',
    manifestWithTitle,
    basePath,
  );
  await writeOutputFile(join(outputDir, 'index.html'), indexHtml);

  // Render concept pages
  for (const concept of manifest.concepts) {
    const html = renderPage(
      conceptTemplate,
      { concept },
      concept.id,
      manifestWithTitle,
      basePath,
    );
    await writeOutputFile(join(outputDir, 'concepts', `${concept.id}.html`), html);
  }

  // Render product pages
  for (const product of manifest.products) {
    const relatedConcepts: ManifestConcept[] = manifest.concepts.filter(
      (c) => c.productId === product.id,
    );
    const html = renderPage(
      productTemplate,
      { product, relatedConcepts },
      product.id,
      manifestWithTitle,
      basePath,
    );
    await writeOutputFile(join(outputDir, 'products', `${product.id}.html`), html);
  }

  // Render policy pages
  for (const policy of manifest.policies) {
    const html = renderPage(
      policyTemplate,
      { policy },
      policy.id,
      manifestWithTitle,
      basePath,
    );
    await writeOutputFile(join(outputDir, 'policies', `${policy.id}.html`), html);
  }

  // Render owner pages
  for (const owner of manifest.owners) {
    const ownedNodes: Array<{ id: string; kind: string; href: string }> = [];

    for (const concept of manifest.concepts) {
      if (concept.owner === owner.id) {
        ownedNodes.push({
          id: concept.id,
          kind: 'concept',
          href: `${basePath}/concepts/${concept.id}.html`,
        });
      }
    }
    for (const product of manifest.products) {
      if (product.owner === owner.id) {
        ownedNodes.push({
          id: product.id,
          kind: 'product',
          href: `${basePath}/products/${product.id}.html`,
        });
      }
    }
    for (const policy of manifest.policies) {
      if (policy.owner === owner.id) {
        ownedNodes.push({
          id: policy.id,
          kind: 'policy',
          href: `${basePath}/policies/${policy.id}.html`,
        });
      }
    }
    for (const entity of manifest.entities) {
      if (entity.owner === owner.id) {
        ownedNodes.push({
          id: entity.id,
          kind: 'entity',
          href: `${basePath}/`,
        });
      }
    }
    for (const term of manifest.terms) {
      if (term.owner === owner.id) {
        ownedNodes.push({
          id: term.id,
          kind: 'term',
          href: `${basePath}/glossary.html`,
        });
      }
    }

    const html = renderPage(
      ownerTemplate,
      { owner, ownedNodes },
      owner.displayName,
      manifestWithTitle,
      basePath,
    );
    await writeOutputFile(join(outputDir, 'owners', `${owner.id}.html`), html);
  }

  // Render glossary page
  const glossaryHtml = renderPage(
    glossaryTemplate,
    { terms: manifest.terms },
    'Glossary',
    manifestWithTitle,
    basePath,
  );
  await writeOutputFile(join(outputDir, 'glossary.html'), glossaryHtml);

  // Render search page
  const searchHtml = renderPage(
    searchTemplate,
    {},
    'Search',
    manifestWithTitle,
    basePath,
  );
  await writeOutputFile(join(outputDir, 'search.html'), searchHtml);

  // Build and write search index
  const searchIndexJson = buildSearchIndex(manifest);
  await writeOutputFile(join(outputDir, 'search-index.json'), searchIndexJson);

  // Write client-side assets
  // Try to read from source assets directory; fall back to embedded content
  let searchJs: string;
  try {
    searchJs = await readFile(resolveAssetPath('search.js'), 'utf-8');
  } catch {
    // Fallback: minimal search script
    searchJs = '// Search functionality - load search-index.json\n';
  }
  await writeOutputFile(join(outputDir, 'search.js'), searchJs);

  let styleCss: string;
  try {
    styleCss = await readFile(resolveAssetPath('style.css'), 'utf-8');
  } catch {
    styleCss = '/* ContextKit Site Styles */\n';
  }
  await writeOutputFile(join(outputDir, 'style.css'), styleCss);
}
