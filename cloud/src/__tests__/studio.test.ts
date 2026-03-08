import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index.js';
import { storage } from '../storage.js';

describe('Studio routes', () => {
  beforeEach(() => {
    storage.clear();
  });

  // -----------------------------------------------------------------------
  // GET /studio — landing page
  // -----------------------------------------------------------------------

  describe('GET /studio', () => {
    it('returns HTML with org input form', async () => {
      const res = await app.request('/studio');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('ContextKit');
      expect(html).toContain('Studio');
      expect(html).toContain('org-form');
      expect(html).toContain('org-input');
    });

    it('includes the dark theme CSS variables', async () => {
      const res = await app.request('/studio');
      const html = await res.text();
      expect(html).toContain('--bg: #0a0a0f');
      expect(html).toContain('--accent: #4f9eff');
    });
  });

  // -----------------------------------------------------------------------
  // GET /studio/:org — org dashboard
  // -----------------------------------------------------------------------

  describe('GET /studio/:org', () => {
    it('returns HTML dashboard for the given org', async () => {
      const res = await app.request('/studio/acme-corp');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('acme-corp');
      expect(html).toContain('dashboard');
      expect(html).toContain('search-input');
      expect(html).toContain('products-list');
      expect(html).toContain('models-list');
    });

    it('sets STUDIO_ORG variable in script', async () => {
      const res = await app.request('/studio/test-org');
      const html = await res.text();
      expect(html).toContain('var STUDIO_ORG="test-org"');
    });

    it('rejects invalid org slugs with redirect', async () => {
      const res = await app.request('/studio/%3Cscript%3E');
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/studio');
    });

    it('includes back link to /studio', async () => {
      const res = await app.request('/studio/acme-corp');
      const html = await res.text();
      expect(html).toContain('href="/studio"');
    });
  });

  // -----------------------------------------------------------------------
  // Integration: studio dashboard fetches from API
  // -----------------------------------------------------------------------

  describe('Studio + API integration', () => {
    it('dashboard page references correct API endpoints', async () => {
      const res = await app.request('/studio/my-org');
      const html = await res.text();
      // The client JS should fetch from these API paths
      expect(html).toContain('/api/orgs/');
      expect(html).toContain('/manifest');
      expect(html).toContain('/products');
      expect(html).toContain('/search');
    });

    it('API returns data that studio can consume', async () => {
      // Publish a plane first
      storage.putPlane('demo', {
        products: { 'player-engagement': { description: 'Player data' } },
        models: { users: { description: 'User table' } },
      }, []);

      // Verify the API endpoints the studio JS will call
      const manifestRes = await app.request('/api/orgs/demo/manifest');
      expect(manifestRes.status).toBe(200);
      const manifest = await manifestRes.json() as Record<string, unknown>;
      expect(manifest).toHaveProperty('org', 'demo');
      expect(manifest).toHaveProperty('version', 1);

      const productsRes = await app.request('/api/orgs/demo/products');
      expect(productsRes.status).toBe(200);
      const products = await productsRes.json() as Record<string, unknown>;
      expect(products).toHaveProperty('products');
      expect((products as { products: string[] }).products).toContain('player-engagement');
    });
  });
});
