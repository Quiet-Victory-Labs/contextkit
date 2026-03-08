import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../index.js';
import {
  clearSubscriptions,
  getSubscription,
  setSubscription,
  incrementUsage,
  canUseFeature,
  checkSeatLimit,
  checkConnectorLimit,
  handleWebhookEvent,
  PLANS,
  type Subscription,
  type StripeEvent,
} from '../billing/stripe.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req(path: string, init?: RequestInit) {
  return app.request(path, init);
}

function authReq(path: string, init?: RequestInit) {
  return app.request(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: 'Bearer test-key',
    },
  });
}

function postJson(path: string, body: unknown, auth = true) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth) headers['Authorization'] = 'Bearer test-key';
  return req(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Unit tests — billing logic
// ---------------------------------------------------------------------------

describe('billing/stripe — unit', () => {
  beforeEach(() => {
    clearSubscriptions();
  });

  describe('getSubscription', () => {
    it('returns free plan for unknown org', () => {
      const sub = getSubscription('acme');
      expect(sub.plan).toBe('free');
      expect(sub.status).toBe('none');
      expect(sub.usage.mcpRequests).toBe(0);
    });

    it('returns existing subscription', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'active',
        usage: { mcpRequests: 100, connectors: 2, seats: 3 },
      });
      const sub = getSubscription('acme');
      expect(sub.plan).toBe('team');
      expect(sub.usage.mcpRequests).toBe(100);
    });
  });

  describe('incrementUsage', () => {
    it('increments MCP requests', () => {
      const usage = incrementUsage('acme', 'mcpRequests');
      expect(usage.mcpRequests).toBe(1);
      incrementUsage('acme', 'mcpRequests', 5);
      expect(getSubscription('acme').usage.mcpRequests).toBe(6);
    });
  });

  describe('canUseFeature', () => {
    it('free plan has no features', () => {
      expect(canUseFeature('acme', 'hosted_mcp')).toBe(false);
      expect(canUseFeature('acme', 'connectors')).toBe(false);
      expect(canUseFeature('acme', 'rbac')).toBe(false);
    });

    it('team plan has hosted_mcp and connectors', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'active',
        usage: { mcpRequests: 0, connectors: 0, seats: 1 },
      });
      expect(canUseFeature('acme', 'hosted_mcp')).toBe(true);
      expect(canUseFeature('acme', 'connectors')).toBe(true);
      expect(canUseFeature('acme', 'rbac')).toBe(false);
    });

    it('enterprise plan has all features', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'enterprise',
        status: 'active',
        usage: { mcpRequests: 0, connectors: 0, seats: 1 },
      });
      expect(canUseFeature('acme', 'hosted_mcp')).toBe(true);
      expect(canUseFeature('acme', 'rbac')).toBe(true);
      expect(canUseFeature('acme', 'priority_support')).toBe(true);
    });

    it('returns false for canceled paid plan', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'canceled',
        usage: { mcpRequests: 0, connectors: 0, seats: 1 },
      });
      expect(canUseFeature('acme', 'hosted_mcp')).toBe(false);
    });
  });

  describe('checkSeatLimit', () => {
    it('free plan allows 1 seat', () => {
      expect(checkSeatLimit('acme')).toBe(false); // default usage.seats = 1, limit = 1
    });

    it('team plan allows 5 seats', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'active',
        usage: { mcpRequests: 0, connectors: 0, seats: 3 },
      });
      expect(checkSeatLimit('acme')).toBe(true);
    });

    it('enterprise plan has unlimited seats', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'enterprise',
        status: 'active',
        usage: { mcpRequests: 0, connectors: 0, seats: 999 },
      });
      expect(checkSeatLimit('acme')).toBe(true);
    });
  });

  describe('checkConnectorLimit', () => {
    it('team plan allows 3 connectors', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'active',
        usage: { mcpRequests: 0, connectors: 2, seats: 1 },
      });
      expect(checkConnectorLimit('acme')).toBe(true);

      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'active',
        usage: { mcpRequests: 0, connectors: 3, seats: 1 },
      });
      expect(checkConnectorLimit('acme')).toBe(false);
    });
  });

  describe('handleWebhookEvent', () => {
    it('handles checkout.session.completed', () => {
      const event: StripeEvent = {
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { org: 'acme', plan: 'team' },
            customer: 'cus_123',
            subscription: 'sub_456',
            client_reference_id: 'acme',
          },
        },
      };

      handleWebhookEvent(event);
      const sub = getSubscription('acme');
      expect(sub.plan).toBe('team');
      expect(sub.status).toBe('active');
      expect(sub.stripeCustomerId).toBe('cus_123');
      expect(sub.stripeSubscriptionId).toBe('sub_456');
    });

    it('handles customer.subscription.updated', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'active',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
        usage: { mcpRequests: 0, connectors: 0, seats: 1 },
      });

      const event: StripeEvent = {
        id: 'evt_2',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_123',
            status: 'past_due',
            current_period_end: 1700000000,
          },
        },
      };

      handleWebhookEvent(event);
      const sub = getSubscription('acme');
      expect(sub.status).toBe('past_due');
      expect(sub.currentPeriodEnd).toBeDefined();
    });

    it('handles customer.subscription.deleted', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'active',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
        usage: { mcpRequests: 0, connectors: 0, seats: 1 },
      });

      const event: StripeEvent = {
        id: 'evt_3',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_123',
          },
        },
      };

      handleWebhookEvent(event);
      const sub = getSubscription('acme');
      expect(sub.plan).toBe('free');
      expect(sub.status).toBe('canceled');
      expect(sub.stripeSubscriptionId).toBeUndefined();
    });

    it('handles invoice.payment_failed', () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'enterprise',
        status: 'active',
        stripeCustomerId: 'cus_789',
        usage: { mcpRequests: 0, connectors: 0, seats: 1 },
      });

      const event: StripeEvent = {
        id: 'evt_4',
        type: 'invoice.payment_failed',
        data: {
          object: { customer: 'cus_789' },
        },
      };

      handleWebhookEvent(event);
      expect(getSubscription('acme').status).toBe('past_due');
    });

    it('ignores unknown event types', () => {
      const event: StripeEvent = {
        id: 'evt_5',
        type: 'some.unknown.event',
        data: { object: {} },
      };
      // Should not throw
      handleWebhookEvent(event);
    });
  });
});

// ---------------------------------------------------------------------------
// Route integration tests
// ---------------------------------------------------------------------------

describe('billing routes', () => {
  beforeEach(() => {
    clearSubscriptions();
  });

  describe('GET /api/billing/subscription/:org', () => {
    it('returns free plan for unknown org', async () => {
      const res = await authReq('/api/billing/subscription/acme');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.plan).toBe('free');
      expect(data.planName).toBe('Free');
      expect(data.usage).toBeDefined();
      expect(data.limits).toBeDefined();
    });

    it('returns active subscription', async () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'active',
        usage: { mcpRequests: 42, connectors: 2, seats: 3 },
      });

      const res = await authReq('/api/billing/subscription/acme');
      const data = await res.json();
      expect(data.plan).toBe('team');
      expect(data.status).toBe('active');
      expect(data.usage.mcpRequests).toBe(42);
      expect(data.limits.seats).toBe(5);
    });

    it('requires auth', async () => {
      const res = await req('/api/billing/subscription/acme');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/billing/checkout', () => {
    it('rejects missing fields', async () => {
      const res = await postJson('/api/billing/checkout', { org: 'acme' });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing required fields');
    });

    it('rejects invalid plan', async () => {
      const res = await postJson('/api/billing/checkout', {
        org: 'acme',
        plan: 'nonexistent',
        successUrl: 'http://example.com/ok',
        cancelUrl: 'http://example.com/cancel',
      });
      expect(res.status).toBe(400);
    });

    it('rejects free plan checkout', async () => {
      const res = await postJson('/api/billing/checkout', {
        org: 'acme',
        plan: 'free',
        successUrl: 'http://example.com/ok',
        cancelUrl: 'http://example.com/cancel',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Cannot create checkout for free plan');
    });

    it('requires auth', async () => {
      const res = await postJson(
        '/api/billing/checkout',
        { org: 'acme', plan: 'team', successUrl: 'x', cancelUrl: 'y' },
        false,
      );
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/billing/webhook', () => {
    it('processes valid webhook event', async () => {
      const event: StripeEvent = {
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { org: 'webhook-org', plan: 'enterprise' },
            customer: 'cus_wh1',
            subscription: 'sub_wh1',
            client_reference_id: 'webhook-org',
          },
        },
      };

      // No webhook secret configured => skip signature check
      const res = await req('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);

      const sub = getSubscription('webhook-org');
      expect(sub.plan).toBe('enterprise');
      expect(sub.status).toBe('active');
    });

    it('rejects invalid JSON', async () => {
      const res = await req('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/billing/portal', () => {
    it('rejects missing fields', async () => {
      const res = await postJson('/api/billing/portal', {});
      expect(res.status).toBe(400);
    });

    it('rejects org without Stripe customer', async () => {
      const res = await postJson('/api/billing/portal', {
        org: 'nocustomer',
        returnUrl: 'http://example.com',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('No Stripe customer');
    });
  });

  describe('GET /api/billing/check/:org/:feature', () => {
    it('returns false for free plan features', async () => {
      const res = await req('/api/billing/check/acme/hosted_mcp');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.allowed).toBe(false);
      expect(data.plan).toBe('free');
    });

    it('returns true for team plan features', async () => {
      setSubscription('acme', {
        org: 'acme',
        plan: 'team',
        status: 'active',
        usage: { mcpRequests: 0, connectors: 0, seats: 1 },
      });

      const res = await req('/api/billing/check/acme/hosted_mcp');
      const data = await res.json();
      expect(data.allowed).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

describe('plan definitions', () => {
  it('team plan is $49/mo', () => {
    expect(PLANS.team.priceMonthly).toBe(4900);
  });

  it('enterprise plan is $299/mo', () => {
    expect(PLANS.enterprise.priceMonthly).toBe(29900);
  });

  it('free plan has no price', () => {
    expect(PLANS.free.priceMonthly).toBe(0);
  });

  it('team plan has correct limits', () => {
    expect(PLANS.team.limits.seats).toBe(5);
    expect(PLANS.team.limits.connectors).toBe(3);
  });

  it('enterprise plan has unlimited seats and connectors', () => {
    expect(PLANS.enterprise.limits.seats).toBe(0);
    expect(PLANS.enterprise.limits.connectors).toBe(0);
  });
});
