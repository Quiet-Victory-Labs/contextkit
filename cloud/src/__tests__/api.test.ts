import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index.js';
import { storage } from '../storage.js';

/** Helper to make requests against the Hono app. */
function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

/** Helper to POST JSON with auth. */
function postPublish(body: unknown, token = 'test-key') {
  return req('/api/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

const sampleManifest = {
  version: '0.5.0',
  generatedAt: '2026-01-01T00:00:00.000Z',
  products: {
    'player-engagement': {
      models: { sessions: { name: 'sessions', description: 'Player session data' } },
      governance: {},
      rules: {},
      lineage: {},
    },
  },
  models: {
    sessions: { name: 'sessions', description: 'Player session data' },
    events: { name: 'events', description: 'Game event log' },
  },
  governance: {},
  rules: {},
  lineage: {},
  terms: {
    dau: { name: 'dau', definition: 'Daily active users' },
  },
  owners: {},
  tiers: {},
};

const sampleFiles = [
  { path: 'models/sessions.yaml', content: 'name: sessions\n' },
  { path: 'models/events.yaml', content: 'name: events\n' },
];

describe('Cloud API', () => {
  beforeEach(() => {
    // Reset in-memory storage between tests
    (storage as any).planes = new Map();
  });

  // -- Health --
  describe('GET /api/health', () => {
    it('returns ok', async () => {
      const res = await req('/api/health');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
  });

  // -- Auth --
  describe('Auth middleware', () => {
    it('rejects requests without Authorization header', async () => {
      const res = await req('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org: 'test', manifest: {}, files: [] }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects requests with empty bearer token', async () => {
      const res = await postPublish({ org: 'test', manifest: {}, files: [] }, '');
      expect(res.status).toBe(401);
    });
  });

  // -- Publish --
  describe('POST /api/publish', () => {
    it('stores a plane and returns 201', async () => {
      const res = await postPublish({
        org: 'acme',
        manifest: sampleManifest,
        files: sampleFiles,
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.ok).toBe(true);
      expect(body.version).toBe('1');
      expect(body.url).toContain('acme');
    });

    it('increments version on subsequent publishes', async () => {
      await postPublish({ org: 'acme', manifest: sampleManifest, files: sampleFiles });
      const res = await postPublish({ org: 'acme', manifest: sampleManifest, files: sampleFiles });
      const body = await res.json() as any;
      expect(body.version).toBe('2');
    });

    it('returns 400 for missing org', async () => {
      const res = await postPublish({ manifest: {}, files: [] });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing manifest', async () => {
      const res = await postPublish({ org: 'acme', files: [] });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing files', async () => {
      const res = await postPublish({ org: 'acme', manifest: {} });
      expect(res.status).toBe(400);
    });
  });

  // -- Get Manifest --
  describe('GET /api/orgs/:org/manifest', () => {
    it('returns 404 for unknown org', async () => {
      const res = await req('/api/orgs/unknown/manifest');
      expect(res.status).toBe(404);
    });

    it('returns the published manifest', async () => {
      await postPublish({ org: 'acme', manifest: sampleManifest, files: sampleFiles });
      const res = await req('/api/orgs/acme/manifest');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.org).toBe('acme');
      expect(body.version).toBe(1);
      expect(body.manifest.version).toBe('0.5.0');
    });
  });

  // -- List Products --
  describe('GET /api/orgs/:org/products', () => {
    it('returns 404 for unknown org', async () => {
      const res = await req('/api/orgs/unknown/products');
      expect(res.status).toBe(404);
    });

    it('lists product names', async () => {
      await postPublish({ org: 'acme', manifest: sampleManifest, files: sampleFiles });
      const res = await req('/api/orgs/acme/products');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.products).toEqual(['player-engagement']);
    });
  });

  // -- Get Product --
  describe('GET /api/orgs/:org/products/:name', () => {
    it('returns 404 for unknown org', async () => {
      const res = await req('/api/orgs/unknown/products/foo');
      expect(res.status).toBe(404);
    });

    it('returns 404 for unknown product', async () => {
      await postPublish({ org: 'acme', manifest: sampleManifest, files: sampleFiles });
      const res = await req('/api/orgs/acme/products/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns product detail', async () => {
      await postPublish({ org: 'acme', manifest: sampleManifest, files: sampleFiles });
      const res = await req('/api/orgs/acme/products/player-engagement');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.name).toBe('player-engagement');
      expect(body.product.models).toBeDefined();
    });
  });

  // -- Search --
  describe('GET /api/orgs/:org/search', () => {
    it('returns 404 for unknown org', async () => {
      const res = await req('/api/orgs/unknown/search?q=test');
      expect(res.status).toBe(404);
    });

    it('returns empty results for empty query', async () => {
      await postPublish({ org: 'acme', manifest: sampleManifest, files: sampleFiles });
      const res = await req('/api/orgs/acme/search?q=');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.results).toEqual([]);
    });

    it('finds models by name', async () => {
      await postPublish({ org: 'acme', manifest: sampleManifest, files: sampleFiles });
      const res = await req('/api/orgs/acme/search?q=sessions');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.results.length).toBeGreaterThan(0);
      expect(body.results.some((r: any) => r.type === 'models' && r.name === 'sessions')).toBe(true);
    });

    it('finds terms by content', async () => {
      await postPublish({ org: 'acme', manifest: sampleManifest, files: sampleFiles });
      const res = await req('/api/orgs/acme/search?q=daily+active');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.results.some((r: any) => r.type === 'terms' && r.name === 'dau')).toBe(true);
    });
  });
});
