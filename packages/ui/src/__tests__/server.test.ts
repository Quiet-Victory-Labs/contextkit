import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createApp } from '../server.js';

function createTestApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runcontext-test-'));
  const contextDir = path.join(tmpDir, 'context');
  fs.mkdirSync(contextDir, { recursive: true });
  const app = createApp({
    rootDir: tmpDir,
    contextDir,
    port: 0,
    host: '127.0.0.1',
  });
  return { app, tmpDir, contextDir };
}

function cleanup(tmpDir: string) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

describe('UI Server', () => {
  let app: ReturnType<typeof createApp>;
  let tmpDir: string;
  let contextDir: string;

  beforeEach(() => {
    const test = createTestApp();
    app = test.app;
    tmpDir = test.tmpDir;
    contextDir = test.contextDir;
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  describe('GET /api/health', () => {
    it('returns ok', async () => {
      const res = await app.request('/api/health');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
  });

  describe('GET /setup', () => {
    it('returns HTML page with RunContext branding', async () => {
      const res = await app.request('/setup');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('RunContext');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('setup.css');
      expect(html).toContain('setup.js');
    });
  });

  describe('GET /', () => {
    it('redirects to /setup', async () => {
      const res = await app.request('/', { redirect: 'manual' });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/setup');
    });
  });

  describe('POST /api/brief', () => {
    it('saves a valid brief', async () => {
      const brief = {
        product_name: 'test-product',
        description: 'A test product',
        owner: { name: 'Test', team: 'Engineering', email: 'test@example.com' },
        sensitivity: 'internal',
      };
      const res = await app.request('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);

      // Verify file was written
      const briefPath = path.join(contextDir, 'test-product.context-brief.yaml');
      expect(fs.existsSync(briefPath)).toBe(true);
    });

    it('rejects invalid brief', async () => {
      const res = await app.request('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'missing product_name' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid brief');
    });
  });

  describe('GET /api/brief/:name', () => {
    it('returns saved brief', async () => {
      // First save
      const brief = {
        product_name: 'my-data',
        description: 'My data product',
        owner: { name: 'T', team: 'A', email: 'a@b.com' },
        sensitivity: 'public',
      };
      await app.request('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief),
      });

      // Then load
      const res = await app.request('/api/brief/my-data');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.product_name).toBe('my-data');
      expect(body.description).toBe('My data product');
    });

    it('returns 404 for non-existent brief', async () => {
      const res = await app.request('/api/brief/nonexistent');
      expect(res.status).toBe(404);
    });

    it('rejects path traversal attempts', async () => {
      const res = await app.request('/api/brief/..%2F..%2Fetc');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/sources', () => {
    it('returns array of sources', async () => {
      const res = await app.request('/api/sources');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('POST /api/pipeline/start', () => {
    it('starts a pipeline run', async () => {
      const res = await app.request('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: 'test', targetTier: 'bronze' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.status).toBe('running');
    });

    it('rejects missing required fields', async () => {
      const res = await app.request('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid tier', async () => {
      const res = await app.request('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: 'test', targetTier: 'diamond' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/pipeline/status/:id', () => {
    it('returns pipeline status', async () => {
      // Start a pipeline first
      const startRes = await app.request('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: 'test', targetTier: 'silver' }),
      });
      const { id } = await startRes.json();

      // Check status
      const res = await app.request(`/api/pipeline/status/${id}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(id);
      expect(body.productName).toBe('test');
      expect(body.stages).toBeDefined();
      expect(Array.isArray(body.stages)).toBe(true);
    });

    it('returns 404 for unknown run', async () => {
      const res = await app.request('/api/pipeline/status/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
