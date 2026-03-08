import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  assignRole,
  removeRole,
  getRole,
  checkPermission,
  requirePermission,
  _resetRoles,
} from '../rbac.js';
import { setAuthUser, type AuthUser } from '../clerk.js';
import {
  setSubscription,
  clearSubscriptions,
  type Subscription,
} from '../../billing/stripe.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an Enterprise subscription for the given org. */
function makeEnterprise(org: string): void {
  const sub: Subscription = {
    org,
    plan: 'enterprise',
    status: 'active',
    usage: { mcpRequests: 0, connectors: 0, seats: 1 },
  };
  setSubscription(org, sub);
}

/** Create a Free subscription for the given org. */
function makeFree(org: string): void {
  const sub: Subscription = {
    org,
    plan: 'free',
    status: 'none',
    usage: { mcpRequests: 0, connectors: 0, seats: 1 },
  };
  setSubscription(org, sub);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  _resetRoles();
  clearSubscriptions();
});

// ---------------------------------------------------------------------------
// Non-Enterprise orgs: RBAC not enforced
// ---------------------------------------------------------------------------

describe('non-Enterprise orgs (RBAC disabled)', () => {
  it('getRole returns admin for any user', () => {
    makeFree('acme');
    expect(getRole('acme', 'user_1')).toBe('admin');
  });

  it('checkPermission returns true for all actions', () => {
    makeFree('acme');
    expect(checkPermission('acme', 'user_1', 'read')).toBe(true);
    expect(checkPermission('acme', 'user_1', 'write')).toBe(true);
    expect(checkPermission('acme', 'user_1', 'publish')).toBe(true);
    expect(checkPermission('acme', 'user_1', 'manage_roles')).toBe(true);
    expect(checkPermission('acme', 'user_1', 'manage_billing')).toBe(true);
  });

  it('ignores assigned roles when RBAC is not enabled', () => {
    makeFree('acme');
    assignRole('acme', 'user_1', 'viewer');
    // Still returns admin because RBAC is not enforced
    expect(getRole('acme', 'user_1')).toBe('admin');
  });
});

// ---------------------------------------------------------------------------
// Enterprise orgs: RBAC enforced
// ---------------------------------------------------------------------------

describe('Enterprise orgs (RBAC enabled)', () => {
  beforeEach(() => {
    makeEnterprise('acme');
  });

  describe('assignRole / getRole', () => {
    it('assigns and retrieves org-level role', () => {
      assignRole('acme', 'user_1', 'editor');
      expect(getRole('acme', 'user_1')).toBe('editor');
    });

    it('returns undefined for users with no role', () => {
      expect(getRole('acme', 'user_1')).toBeUndefined();
    });

    it('assigns product-specific role', () => {
      assignRole('acme', 'user_1', 'viewer', 'product-a');
      expect(getRole('acme', 'user_1', 'product-a')).toBe('viewer');
    });

    it('product-specific role overrides org-level role', () => {
      assignRole('acme', 'user_1', 'admin');
      assignRole('acme', 'user_1', 'viewer', 'product-a');
      expect(getRole('acme', 'user_1', 'product-a')).toBe('viewer');
      // Org-level still returns admin
      expect(getRole('acme', 'user_1')).toBe('admin');
    });

    it('falls back to org-level when no product-specific role exists', () => {
      assignRole('acme', 'user_1', 'editor');
      expect(getRole('acme', 'user_1', 'product-b')).toBe('editor');
    });
  });

  describe('removeRole', () => {
    it('removes org-level role', () => {
      assignRole('acme', 'user_1', 'editor');
      removeRole('acme', 'user_1');
      expect(getRole('acme', 'user_1')).toBeUndefined();
    });

    it('removes product-specific role without affecting org-level', () => {
      assignRole('acme', 'user_1', 'admin');
      assignRole('acme', 'user_1', 'viewer', 'product-a');
      removeRole('acme', 'user_1', 'product-a');
      expect(getRole('acme', 'user_1', 'product-a')).toBe('admin');
      expect(getRole('acme', 'user_1')).toBe('admin');
    });
  });

  describe('checkPermission', () => {
    it('viewer can only read', () => {
      assignRole('acme', 'user_1', 'viewer');
      expect(checkPermission('acme', 'user_1', 'read')).toBe(true);
      expect(checkPermission('acme', 'user_1', 'write')).toBe(false);
      expect(checkPermission('acme', 'user_1', 'publish')).toBe(false);
      expect(checkPermission('acme', 'user_1', 'manage_roles')).toBe(false);
      expect(checkPermission('acme', 'user_1', 'manage_billing')).toBe(false);
    });

    it('editor can read and write', () => {
      assignRole('acme', 'user_1', 'editor');
      expect(checkPermission('acme', 'user_1', 'read')).toBe(true);
      expect(checkPermission('acme', 'user_1', 'write')).toBe(true);
      expect(checkPermission('acme', 'user_1', 'publish')).toBe(false);
      expect(checkPermission('acme', 'user_1', 'manage_roles')).toBe(false);
    });

    it('admin can do everything', () => {
      assignRole('acme', 'user_1', 'admin');
      expect(checkPermission('acme', 'user_1', 'read')).toBe(true);
      expect(checkPermission('acme', 'user_1', 'write')).toBe(true);
      expect(checkPermission('acme', 'user_1', 'publish')).toBe(true);
      expect(checkPermission('acme', 'user_1', 'manage_roles')).toBe(true);
      expect(checkPermission('acme', 'user_1', 'manage_billing')).toBe(true);
    });

    it('returns false for users with no role', () => {
      expect(checkPermission('acme', 'user_1', 'read')).toBe(false);
    });

    it('uses product-specific role for permission checks', () => {
      assignRole('acme', 'user_1', 'admin');
      assignRole('acme', 'user_1', 'viewer', 'product-a');
      // Product-specific: viewer => can only read
      expect(checkPermission('acme', 'user_1', 'write', 'product-a')).toBe(false);
      expect(checkPermission('acme', 'user_1', 'read', 'product-a')).toBe(true);
      // Org-level: admin => can write
      expect(checkPermission('acme', 'user_1', 'write')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// requirePermission middleware
// ---------------------------------------------------------------------------

describe('requirePermission middleware', () => {
  function createApp(action: 'read' | 'write' | 'publish' | 'manage_roles' | 'manage_billing') {
    const app = new Hono();

    // Simulate auth middleware by setting user
    app.use('*', async (c, next) => {
      const userId = c.req.header('X-Test-User');
      const orgId = c.req.header('X-Test-Org');
      if (userId) {
        setAuthUser(c, { userId, orgId } as AuthUser);
      }
      await next();
    });

    app.get('/api/orgs/:org/data', requirePermission(action), (c) => {
      return c.json({ ok: true });
    });

    return app;
  }

  beforeEach(() => {
    makeEnterprise('acme');
  });

  it('returns 401 if no auth user', async () => {
    const app = createApp('read');
    const res = await app.request('/api/orgs/acme/data');
    expect(res.status).toBe(401);
  });

  it('returns 403 if user lacks permission', async () => {
    assignRole('acme', 'user_1', 'viewer');
    const app = createApp('write');
    const res = await app.request('/api/orgs/acme/data', {
      headers: { 'X-Test-User': 'user_1', 'X-Test-Org': 'acme' },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/write/);
  });

  it('allows access when user has permission', async () => {
    assignRole('acme', 'user_1', 'editor');
    const app = createApp('write');
    const res = await app.request('/api/orgs/acme/data', {
      headers: { 'X-Test-User': 'user_1', 'X-Test-Org': 'acme' },
    });
    expect(res.status).toBe(200);
  });

  it('reads org from route param', async () => {
    assignRole('acme', 'user_1', 'admin');
    const app = createApp('publish');
    const res = await app.request('/api/orgs/acme/data', {
      headers: { 'X-Test-User': 'user_1' }, // no X-Test-Org, relies on :org param
    });
    expect(res.status).toBe(200);
  });

  it('falls back to auth user orgId when no route param', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      setAuthUser(c, { userId: 'user_1', orgId: 'acme' } as AuthUser);
      await next();
    });
    app.get('/data', requirePermission('read'), (c) => c.json({ ok: true }));

    assignRole('acme', 'user_1', 'viewer');
    const res = await app.request('/data');
    expect(res.status).toBe(200);
  });

  it('returns 403 when no org context is available', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      setAuthUser(c, { userId: 'user_1' } as AuthUser);
      await next();
    });
    app.get('/data', requirePermission('read'), (c) => c.json({ ok: true }));

    const res = await app.request('/data');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/no org/i);
  });

  it('bypasses RBAC for non-Enterprise orgs', async () => {
    makeFree('acme');
    // No role assigned, but non-Enterprise => admin
    const app = createApp('publish');
    const res = await app.request('/api/orgs/acme/data', {
      headers: { 'X-Test-User': 'user_1', 'X-Test-Org': 'acme' },
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// requirePermission with product scope
// ---------------------------------------------------------------------------

describe('requirePermission with product scope', () => {
  function createProductApp() {
    const app = new Hono();
    app.use('*', async (c, next) => {
      const userId = c.req.header('X-Test-User');
      if (userId) {
        setAuthUser(c, { userId, orgId: 'acme' } as AuthUser);
      }
      await next();
    });

    // Static product scope
    app.get('/api/orgs/:org/products/catalog/items', requirePermission('read', 'catalog'), (c) => {
      return c.json({ ok: true });
    });

    // Dynamic product scope via route param
    app.get('/api/orgs/:org/products/:product/items', requirePermission('write'), (c) => {
      return c.json({ ok: true });
    });

    return app;
  }

  beforeEach(() => {
    makeEnterprise('acme');
  });

  it('checks product-specific role with static product', async () => {
    assignRole('acme', 'user_1', 'admin');
    assignRole('acme', 'user_1', 'viewer', 'catalog');
    const app = createProductApp();

    // Can read catalog (viewer has read)
    const readRes = await app.request('/api/orgs/acme/products/catalog/items', {
      headers: { 'X-Test-User': 'user_1' },
    });
    expect(readRes.status).toBe(200);
  });

  it('checks product-specific role via route param', async () => {
    assignRole('acme', 'user_1', 'admin');
    assignRole('acme', 'user_1', 'viewer', 'inventory');
    const app = createProductApp();

    // Cannot write to inventory (viewer lacks write)
    const res = await app.request('/api/orgs/acme/products/inventory/items', {
      headers: { 'X-Test-User': 'user_1' },
    });
    expect(res.status).toBe(403);
  });
});
