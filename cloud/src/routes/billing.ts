import { Hono } from 'hono';
import {
  PLANS,
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  verifyWebhookSignature,
  handleWebhookEvent,
  canUseFeature,
  type PlanId,
  type StripeEvent,
  type Feature,
} from '../billing/stripe.js';

const billing = new Hono();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnv(c: { env?: unknown }, key: string): string | undefined {
  const env = (c.env ?? {}) as Record<string, unknown>;
  if (typeof env[key] === 'string' && env[key]) {
    return env[key] as string;
  }
  if (typeof globalThis.process !== 'undefined') {
    return globalThis.process.env?.[key] || undefined;
  }
  return undefined;
}

function requireStripeKey(c: { env?: unknown }): string {
  const key = getEnv(c, 'STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return key;
}

// ---------------------------------------------------------------------------
// POST /api/billing/checkout — create a Stripe Checkout session
// ---------------------------------------------------------------------------

billing.post('/api/billing/checkout', async (c) => {
  try {
    const body = await c.req.json<{
      org: string;
      plan: PlanId;
      successUrl: string;
      cancelUrl: string;
    }>();

    if (!body.org || !body.plan || !body.successUrl || !body.cancelUrl) {
      return c.json({ error: 'Missing required fields: org, plan, successUrl, cancelUrl' }, 400);
    }

    if (!PLANS[body.plan]) {
      return c.json({ error: `Invalid plan: ${body.plan}` }, 400);
    }

    if (body.plan === 'free') {
      return c.json({ error: 'Cannot create checkout for free plan' }, 400);
    }

    const secretKey = requireStripeKey(c);

    const session = await createCheckoutSession(
      { secretKey },
      body.org,
      body.plan,
      body.successUrl,
      body.cancelUrl,
    );

    return c.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return c.json({ error: message }, 400);
  }
});

// ---------------------------------------------------------------------------
// POST /api/billing/webhook — Stripe webhook handler
// ---------------------------------------------------------------------------

billing.post('/api/billing/webhook', async (c) => {
  const webhookSecret = getEnv(c, 'STRIPE_WEBHOOK_SECRET');

  // Read raw body for signature verification
  const payload = await c.req.text();
  const signature = c.req.header('Stripe-Signature') ?? '';

  // Verify signature if webhook secret is configured
  if (webhookSecret) {
    const valid = await verifyWebhookSignature(payload, signature, webhookSecret);
    if (!valid) {
      return c.json({ error: 'Invalid webhook signature' }, 400);
    }
  }

  try {
    const event = JSON.parse(payload) as StripeEvent;
    handleWebhookEvent(event);
    return c.json({ received: true });
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }
});

// ---------------------------------------------------------------------------
// GET /api/billing/subscription/:org — get subscription + usage
// ---------------------------------------------------------------------------

billing.get('/api/billing/subscription/:org', (c) => {
  const org = c.req.param('org');
  const sub = getSubscription(org);
  const plan = PLANS[sub.plan];

  return c.json({
    org: sub.org,
    plan: sub.plan,
    planName: plan.name,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    usage: sub.usage,
    limits: plan.limits,
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/portal — create customer portal session
// ---------------------------------------------------------------------------

billing.post('/api/billing/portal', async (c) => {
  try {
    const body = await c.req.json<{ org: string; returnUrl: string }>();

    if (!body.org || !body.returnUrl) {
      return c.json({ error: 'Missing required fields: org, returnUrl' }, 400);
    }

    // Check for customer before requiring Stripe key
    const existingSub = getSubscription(body.org);
    if (!existingSub.stripeCustomerId) {
      return c.json({ error: 'No Stripe customer for this org' }, 400);
    }

    const secretKey = requireStripeKey(c);

    const session = await createPortalSession(
      { secretKey },
      body.org,
      body.returnUrl,
    );

    return c.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Portal session failed';
    return c.json({ error: message }, 400);
  }
});

// ---------------------------------------------------------------------------
// GET /api/billing/check/:org/:feature — check feature access
// ---------------------------------------------------------------------------

billing.get('/api/billing/check/:org/:feature', (c) => {
  const org = c.req.param('org');
  const feature = c.req.param('feature') as Feature;

  return c.json({
    org,
    feature,
    allowed: canUseFeature(org, feature),
    plan: getSubscription(org).plan,
  });
});

export { billing };
