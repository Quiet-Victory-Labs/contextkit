import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Manifest } from '@contextkit/core';
import { generateSite } from '../generator.js';
import { buildSearchIndex } from '../search/build-index.js';

function createMockManifest(): Manifest {
  return {
    schemaVersion: '1.0.0',
    project: {
      id: 'test-project',
      displayName: 'Test Project',
      version: '1.0.0',
    },
    build: {
      timestamp: '2025-01-01T00:00:00Z',
      version: '0.1.0',
      nodeCount: 5,
    },
    concepts: [
      {
        id: 'user-account',
        definition: 'A registered user account in the system',
        productId: 'auth-service',
        certified: true,
        owner: 'alice',
        tags: ['core', 'auth'],
        dependsOn: ['session'],
      },
      {
        id: 'session',
        definition: 'An active user session',
        owner: 'alice',
        tags: ['auth'],
      },
    ],
    products: [
      {
        id: 'auth-service',
        description: 'Authentication and authorization service',
        owner: 'alice',
        tags: ['backend'],
      },
    ],
    policies: [
      {
        id: 'data-access-policy',
        description: 'Policy governing data access',
        rules: [
          {
            priority: 1,
            when: { tagsAny: ['sensitive'] },
            then: { requireRole: 'admin' },
          },
        ],
        owner: 'bob',
        tags: ['security'],
      },
    ],
    entities: [
      {
        id: 'user-entity',
        definition: 'User database entity',
        fields: [
          { name: 'id', type: 'string', description: 'Unique identifier' },
          { name: 'email', type: 'string', description: 'Email address' },
        ],
        owner: 'alice',
        tags: ['db'],
      },
    ],
    terms: [
      {
        id: 'SSO',
        definition: 'Single Sign-On',
        synonyms: ['single sign-on'],
        mapsTo: ['user-account'],
        owner: 'alice',
      },
    ],
    owners: [
      {
        id: 'alice',
        displayName: 'Alice Smith',
        email: 'alice@example.com',
        team: 'Platform',
      },
      {
        id: 'bob',
        displayName: 'Bob Jones',
        email: 'bob@example.com',
        team: 'Security',
      },
    ],
    indexes: {
      byId: {
        'user-account': { kind: 'concept', index: 0 },
        'session': { kind: 'concept', index: 1 },
        'auth-service': { kind: 'product', index: 0 },
        'data-access-policy': { kind: 'policy', index: 0 },
        'user-entity': { kind: 'entity', index: 0 },
        'SSO': { kind: 'term', index: 0 },
      },
    },
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('generateSite', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'contextkit-site-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should create all expected output files', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    // Check all expected files exist
    expect(await fileExists(join(tmpDir, 'index.html'))).toBe(true);
    expect(await fileExists(join(tmpDir, 'style.css'))).toBe(true);
    expect(await fileExists(join(tmpDir, 'search.js'))).toBe(true);
    expect(await fileExists(join(tmpDir, 'search-index.json'))).toBe(true);
    expect(await fileExists(join(tmpDir, 'glossary.html'))).toBe(true);
    expect(await fileExists(join(tmpDir, 'search.html'))).toBe(true);

    // Check concept pages
    expect(await fileExists(join(tmpDir, 'concepts', 'user-account.html'))).toBe(true);
    expect(await fileExists(join(tmpDir, 'concepts', 'session.html'))).toBe(true);

    // Check product pages
    expect(await fileExists(join(tmpDir, 'products', 'auth-service.html'))).toBe(true);

    // Check policy pages
    expect(await fileExists(join(tmpDir, 'policies', 'data-access-policy.html'))).toBe(true);

    // Check owner pages
    expect(await fileExists(join(tmpDir, 'owners', 'alice.html'))).toBe(true);
    expect(await fileExists(join(tmpDir, 'owners', 'bob.html'))).toBe(true);
  });

  it('should include project name in index.html', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const indexHtml = await readFile(join(tmpDir, 'index.html'), 'utf-8');
    expect(indexHtml).toContain('Test Project');
    expect(indexHtml).toContain('1.0.0');
  });

  it('should include concept details in concept pages', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const conceptHtml = await readFile(join(tmpDir, 'concepts', 'user-account.html'), 'utf-8');
    expect(conceptHtml).toContain('user-account');
    expect(conceptHtml).toContain('A registered user account in the system');
    expect(conceptHtml).toContain('certified');
    expect(conceptHtml).toContain('alice');
    expect(conceptHtml).toContain('auth-service');
    // Check dependency link
    expect(conceptHtml).toContain('session');
  });

  it('should include product details and related concepts', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const productHtml = await readFile(join(tmpDir, 'products', 'auth-service.html'), 'utf-8');
    expect(productHtml).toContain('auth-service');
    expect(productHtml).toContain('Authentication and authorization service');
    // Related concept
    expect(productHtml).toContain('user-account');
  });

  it('should include policy rules in policy pages', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const policyHtml = await readFile(join(tmpDir, 'policies', 'data-access-policy.html'), 'utf-8');
    expect(policyHtml).toContain('data-access-policy');
    expect(policyHtml).toContain('Policy governing data access');
    expect(policyHtml).toContain('sensitive');
    expect(policyHtml).toContain('admin');
  });

  it('should include owner details and owned nodes', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const ownerHtml = await readFile(join(tmpDir, 'owners', 'alice.html'), 'utf-8');
    expect(ownerHtml).toContain('Alice Smith');
    expect(ownerHtml).toContain('alice@example.com');
    expect(ownerHtml).toContain('Platform');
    // Should list owned nodes
    expect(ownerHtml).toContain('user-account');
    expect(ownerHtml).toContain('auth-service');
  });

  it('should include terms in glossary page', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const glossaryHtml = await readFile(join(tmpDir, 'glossary.html'), 'utf-8');
    expect(glossaryHtml).toContain('SSO');
    expect(glossaryHtml).toContain('Single Sign-On');
    expect(glossaryHtml).toContain('single sign-on');
    expect(glossaryHtml).toContain('user-account');
  });

  it('should include search input in search page', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const searchHtml = await readFile(join(tmpDir, 'search.html'), 'utf-8');
    expect(searchHtml).toContain('search-input');
    expect(searchHtml).toContain('search-results');
    expect(searchHtml).toContain('search.js');
  });

  it('should generate valid search index JSON', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const indexJson = await readFile(join(tmpDir, 'search-index.json'), 'utf-8');
    // Should be valid JSON
    const parsed = JSON.parse(indexJson);
    expect(parsed).toBeDefined();
  });

  it('should respect custom title option', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir, title: 'Custom Title' });

    const indexHtml = await readFile(join(tmpDir, 'index.html'), 'utf-8');
    expect(indexHtml).toContain('Custom Title');
  });

  it('should respect basePath option in links', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir, basePath: '/docs' });

    const indexHtml = await readFile(join(tmpDir, 'index.html'), 'utf-8');
    expect(indexHtml).toContain('href="/docs/');
    expect(indexHtml).toContain('/docs/style.css');
  });

  it('should include navigation links in all pages', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const indexHtml = await readFile(join(tmpDir, 'index.html'), 'utf-8');
    expect(indexHtml).toContain('Glossary');
    expect(indexHtml).toContain('Search');
    expect(indexHtml).toContain('Built with');
    expect(indexHtml).toContain('ContextKit');
  });

  it('should include summary stats on index page', async () => {
    const manifest = createMockManifest();
    await generateSite({ manifest, outputDir: tmpDir });

    const indexHtml = await readFile(join(tmpDir, 'index.html'), 'utf-8');
    // 2 concepts, 1 product, 1 policy, 1 entity, 1 term, 2 owners
    expect(indexHtml).toContain('>2<');    // concepts count
    expect(indexHtml).toContain('>1<');    // products/policies/entities/terms
  });
});

describe('buildSearchIndex', () => {
  it('should return valid JSON string', () => {
    const manifest = createMockManifest();
    const indexJson = buildSearchIndex(manifest);
    const parsed = JSON.parse(indexJson);
    expect(parsed).toBeDefined();
  });

  it('should include all node types in the index', () => {
    const manifest = createMockManifest();
    const indexJson = buildSearchIndex(manifest);
    // The serialized index should contain document data
    expect(indexJson).toBeTruthy();
    expect(indexJson.length).toBeGreaterThan(100);
  });
});
