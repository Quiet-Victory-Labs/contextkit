import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth.js';
import { getAuthUser, decodeJwt, _resetJwksCache } from '../clerk.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake JWT (header.payload.signature) — NOT cryptographically valid. */
function fakeJwt(payload: Record<string, unknown>, kid = 'test-kid'): string {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode(header)}.${encode(payload)}.fake-signature`;
}

// ---------------------------------------------------------------------------
// Unit tests: decodeJwt
// ---------------------------------------------------------------------------

describe('decodeJwt', () => {
  it('decodes a well-formed JWT', () => {
    const token = fakeJwt({ sub: 'user_123', org_id: 'org_abc', exp: 9999999999 });
    const { header, payload } = decodeJwt(token);
    expect(header.alg).toBe('RS256');
    expect(payload.sub).toBe('user_123');
    expect(payload.org_id).toBe('org_abc');
  });

  it('throws on malformed token', () => {
    expect(() => decodeJwt('not-a-jwt')).toThrow('Invalid JWT');
    expect(() => decodeJwt('a.b')).toThrow('Invalid JWT');
  });
});

// ---------------------------------------------------------------------------
// Integration tests: requireAuth middleware
// ---------------------------------------------------------------------------

describe('requireAuth middleware', () => {
  beforeEach(() => {
    _resetJwksCache();
  });

  // ---- Fallback mode (no CLERK_SECRET_KEY) ----

  describe('fallback mode (no CLERK_SECRET_KEY)', () => {
    function createApp() {
      const app = new Hono();
      app.use('/protected', requireAuth);
      app.get('/protected', (c) => {
        const user = getAuthUser(c);
        return c.json({ user });
      });
      return app;
    }

    it('rejects requests without Authorization header', async () => {
      const app = createApp();
      const res = await app.request('/protected');
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/Missing/);
    });

    it('rejects requests with empty Bearer token', async () => {
      const app = createApp();
      const res = await app.request('/protected', {
        headers: { Authorization: 'Bearer ' },
      });
      expect(res.status).toBe(401);
    });

    it('rejects non-Bearer auth', async () => {
      const app = createApp();
      const res = await app.request('/protected', {
        headers: { Authorization: 'Basic abc123' },
      });
      expect(res.status).toBe(401);
    });

    it('allows requests with a valid bearer token and sets anonymous user', async () => {
      const app = createApp();
      const res = await app.request('/protected', {
        headers: { Authorization: 'Bearer my-dev-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user).toEqual({ userId: 'anonymous' });
    });
  });

  // ---- Clerk mode (CLERK_SECRET_KEY set) ----

  describe('Clerk mode (CLERK_SECRET_KEY set)', () => {
    function createApp() {
      const app = new Hono<{ Bindings: { CLERK_SECRET_KEY: string } }>();
      app.use('/protected', requireAuth);
      app.get('/protected', (c) => {
        const user = getAuthUser(c);
        return c.json({ user });
      });
      return app;
    }

    it('rejects an expired JWT', async () => {
      const app = createApp();
      const token = fakeJwt({
        sub: 'user_123',
        iss: 'https://clerk.example.com',
        exp: 1000000, // long expired
        iat: 999999,
      });
      const res = await app.request('/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }, { CLERK_SECRET_KEY: 'sk_test_xxx' });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/expired/i);
    });

    it('rejects a JWT missing sub claim', async () => {
      const app = createApp();
      const token = fakeJwt({
        iss: 'https://clerk.example.com',
        exp: 9999999999,
        iat: 999999,
      });
      const res = await app.request('/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }, { CLERK_SECRET_KEY: 'sk_test_xxx' });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/sub/i);
    });

    it('rejects a JWT missing iss claim', async () => {
      const app = createApp();
      const token = fakeJwt({
        sub: 'user_123',
        exp: 9999999999,
        iat: 999999,
      });
      const res = await app.request('/protected', {
        headers: { Authorization: `Bearer ${token}` },
      }, { CLERK_SECRET_KEY: 'sk_test_xxx' });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/iss/i);
    });
  });
});

// ---------------------------------------------------------------------------
// Route protection tests (app-level)
// ---------------------------------------------------------------------------

describe('route protection', () => {
  // Import the actual app to test route-level protection.
  // We re-create a mini version to avoid importing the full app which has
  // storage dependencies.

  function createFullApp() {
    const app = new Hono();
    app.get('/api/health', (c) => c.json({ ok: true }));
    app.get('/studio', (c) => c.html('<h1>Studio</h1>'));
    app.get('/studio/:org', (c) => c.html('<h1>Studio Org</h1>'));
    app.use('/api/publish', requireAuth);
    app.use('/api/orgs/:org/*', requireAuth);
    app.post('/api/publish', (c) => c.json({ ok: true }));
    app.get('/api/orgs/acme/manifest', (c) => c.json({ org: 'acme' }));
    return app;
  }

  it('allows /api/health without auth', async () => {
    const app = createFullApp();
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
  });

  it('allows /studio without auth', async () => {
    const app = createFullApp();
    const res = await app.request('/studio');
    expect(res.status).toBe(200);
  });

  it('allows /studio/:org without auth', async () => {
    const app = createFullApp();
    const res = await app.request('/studio/acme');
    expect(res.status).toBe(200);
  });

  it('requires auth for /api/publish', async () => {
    const app = createFullApp();
    const res = await app.request('/api/publish', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('requires auth for /api/orgs/:org/*', async () => {
    const app = createFullApp();
    const res = await app.request('/api/orgs/acme/manifest');
    expect(res.status).toBe(401);
  });

  it('allows protected routes with bearer token (fallback mode)', async () => {
    const app = createFullApp();
    const res = await app.request('/api/orgs/acme/manifest', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(200);
  });
});
