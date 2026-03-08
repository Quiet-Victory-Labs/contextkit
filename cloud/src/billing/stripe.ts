/**
 * Stripe billing module for ContextKit Cloud.
 *
 * Uses Stripe's REST API directly (no SDK) to stay compatible with
 * Cloudflare Workers. Subscription state is stored in-memory for now.
 */

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

export type PlanId = 'free' | 'team' | 'enterprise';

export type Feature =
  | 'hosted_semantic_plane'
  | 'hosted_mcp'
  | 'connectors'
  | 'rbac'
  | 'priority_support';

export interface PlanLimits {
  seats: number;          // 0 = unlimited
  connectors: number;     // 0 = unlimited
  mcpRequests: number;    // 0 = unlimited (per month)
  features: Feature[];
}

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;   // cents
  stripePriceId?: string;  // set via env/config
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    limits: {
      seats: 1,
      connectors: 0,
      mcpRequests: 0,
      features: [],
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    priceMonthly: 4900, // $49/mo
    limits: {
      seats: 5,
      connectors: 3,
      mcpRequests: 10_000,
      features: ['hosted_semantic_plane', 'hosted_mcp', 'connectors'],
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 29900, // $299/mo
    limits: {
      seats: 0, // unlimited
      connectors: 0, // unlimited
      mcpRequests: 0, // unlimited
      features: [
        'hosted_semantic_plane',
        'hosted_mcp',
        'connectors',
        'rbac',
        'priority_support',
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// In-memory subscription store
// ---------------------------------------------------------------------------

export interface Usage {
  mcpRequests: number;
  connectors: number;
  seats: number;
}

export interface Subscription {
  org: string;
  plan: PlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';
  currentPeriodEnd?: string;
  usage: Usage;
}

/** In-memory store — keyed by org slug. */
const subscriptions = new Map<string, Subscription>();

export function getSubscription(org: string): Subscription {
  const existing = subscriptions.get(org);
  if (existing) return existing;

  // Default to free plan
  const sub: Subscription = {
    org,
    plan: 'free',
    status: 'none',
    usage: { mcpRequests: 0, connectors: 0, seats: 1 },
  };
  subscriptions.set(org, sub);
  return sub;
}

export function setSubscription(org: string, sub: Subscription): void {
  subscriptions.set(org, sub);
}

/** Clear all subscriptions (for testing). */
export function clearSubscriptions(): void {
  subscriptions.clear();
}

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

export function incrementUsage(
  org: string,
  metric: keyof Usage,
  amount = 1,
): Usage {
  const sub = getSubscription(org);
  sub.usage[metric] += amount;
  return sub.usage;
}

// ---------------------------------------------------------------------------
// Feature gating
// ---------------------------------------------------------------------------

export function canUseFeature(org: string, feature: Feature): boolean {
  const sub = getSubscription(org);
  const plan = PLANS[sub.plan];

  // Must have an active (or trialing) subscription for paid plans
  if (sub.plan !== 'free' && sub.status !== 'active' && sub.status !== 'trialing') {
    return false;
  }

  return plan.limits.features.includes(feature);
}

export function checkSeatLimit(org: string): boolean {
  const sub = getSubscription(org);
  const plan = PLANS[sub.plan];
  if (plan.limits.seats === 0) return true; // unlimited
  return sub.usage.seats < plan.limits.seats;
}

export function checkConnectorLimit(org: string): boolean {
  const sub = getSubscription(org);
  const plan = PLANS[sub.plan];
  if (plan.limits.connectors === 0) return true; // unlimited
  return sub.usage.connectors < plan.limits.connectors;
}

// ---------------------------------------------------------------------------
// Stripe API helpers (raw fetch — no SDK)
// ---------------------------------------------------------------------------

const STRIPE_API = 'https://api.stripe.com/v1';

interface StripeConfig {
  secretKey: string;
  webhookSecret?: string;
}

function stripeHeaders(secretKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * Create a Stripe Checkout Session for the given plan.
 */
export async function createCheckoutSession(
  config: StripeConfig,
  org: string,
  plan: PlanId,
  successUrl: string,
  cancelUrl: string,
): Promise<{ sessionId: string; url: string }> {
  if (plan === 'free') {
    throw new Error('Cannot create checkout for free plan');
  }

  const planDef = PLANS[plan];
  if (!planDef.stripePriceId) {
    throw new Error(`No Stripe price ID configured for plan: ${plan}`);
  }

  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': planDef.stripePriceId,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    'metadata[org]': org,
    'metadata[plan]': plan,
    client_reference_id: org,
  };

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: stripeHeaders(config.secretKey),
    body: formEncode(params),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe checkout failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: string; url: string };
  return { sessionId: data.id, url: data.url };
}

/**
 * Create a Stripe Customer Portal session.
 */
export async function createPortalSession(
  config: StripeConfig,
  org: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const sub = getSubscription(org);
  if (!sub.stripeCustomerId) {
    throw new Error('No Stripe customer for this org');
  }

  const params: Record<string, string> = {
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  };

  const res = await fetch(`${STRIPE_API}/billing_portal/sessions`, {
    method: 'POST',
    headers: stripeHeaders(config.secretKey),
    body: formEncode(params),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe portal failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { url: string };
  return { url: data.url };
}

// ---------------------------------------------------------------------------
// Webhook handling
// ---------------------------------------------------------------------------

/**
 * Verify Stripe webhook signature (HMAC-SHA256).
 *
 * Stripe signs with `whsec_xxx` and sends `Stripe-Signature` header
 * containing `t=<timestamp>,v1=<signature>`.
 */
export async function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(',');
  const tsEntry = parts.find((p) => p.startsWith('t='));
  const sigEntry = parts.find((p) => p.startsWith('v1='));

  if (!tsEntry || !sigEntry) return false;

  const timestamp = tsEntry.slice(2);
  const expectedSig = sigEntry.slice(3);

  const signedPayload = `${timestamp}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload),
  );

  const computedSig = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSig === expectedSig;
}

/** Stripe event shape (minimal). */
export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

/**
 * Process a verified Stripe webhook event.
 * Updates the in-memory subscription store.
 */
export function handleWebhookEvent(event: StripeEvent): void {
  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const org = (obj['metadata'] as Record<string, string>)?.['org'] ??
        (obj['client_reference_id'] as string);
      const plan = ((obj['metadata'] as Record<string, string>)?.['plan'] ?? 'team') as PlanId;
      const customerId = obj['customer'] as string;
      const subscriptionId = obj['subscription'] as string;

      if (org) {
        const sub = getSubscription(org);
        sub.plan = plan;
        sub.stripeCustomerId = customerId;
        sub.stripeSubscriptionId = subscriptionId;
        sub.status = 'active';
      }
      break;
    }

    case 'customer.subscription.updated': {
      const customerId = obj['customer'] as string;
      const status = obj['status'] as string;
      const periodEnd = obj['current_period_end'] as number | undefined;
      const sub = findByCustomer(customerId);
      if (sub) {
        if (status === 'active' || status === 'trialing') {
          sub.status = status;
        } else if (status === 'past_due') {
          sub.status = 'past_due';
        }
        if (periodEnd) {
          sub.currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const customerId = obj['customer'] as string;
      const sub = findByCustomer(customerId);
      if (sub) {
        sub.plan = 'free';
        sub.status = 'canceled';
        sub.stripeSubscriptionId = undefined;
      }
      break;
    }

    case 'invoice.payment_failed': {
      const customerId = obj['customer'] as string;
      const sub = findByCustomer(customerId);
      if (sub) {
        sub.status = 'past_due';
      }
      break;
    }

    default:
      // Ignore unhandled event types
      break;
  }
}

/** Find a subscription by Stripe customer ID. */
function findByCustomer(customerId: string): Subscription | undefined {
  for (const sub of subscriptions.values()) {
    if (sub.stripeCustomerId === customerId) {
      return sub;
    }
  }
  return undefined;
}
