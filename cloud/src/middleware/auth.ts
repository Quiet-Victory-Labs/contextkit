import type { Context, Next } from 'hono';
import { verifyClerkToken, setAuthUser, type AuthUser } from '../auth/clerk.js';

/**
 * Auth middleware for the ContextKit Cloud API.
 *
 * When `CLERK_SECRET_KEY` is set in the environment, verifies the JWT using
 * Clerk's JWKS endpoint and extracts org/user info from the claims.
 *
 * Otherwise falls back to a simple bearer-token check (for local dev).
 */
export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const header = c.req.header('Authorization');

  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return c.json({ error: 'Missing API key' }, 401);
  }

  const clerkKey = getEnv(c, 'CLERK_SECRET_KEY');

  if (clerkKey) {
    // ---- Clerk JWT verification ----
    try {
      const user = await verifyClerkToken(token);
      setAuthUser(c, user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token verification failed';
      return c.json({ error: `Unauthorized: ${message}` }, 401);
    }
  } else {
    // ---- Simple bearer fallback (local dev) ----
    const fallbackUser: AuthUser = {
      userId: 'anonymous',
    };
    setAuthUser(c, fallbackUser);
  }

  // Also store the raw token for backward compatibility
  c.set('apiKey', token);

  await next();
}

/**
 * Read an environment variable from the Hono context.
 * Works with both Cloudflare Workers bindings (c.env) and process.env.
 */
function getEnv(c: Context, key: string): string | undefined {
  // Cloudflare Workers expose env vars via c.env
  const env = (c.env ?? {}) as Record<string, unknown>;
  if (typeof env[key] === 'string' && env[key]) {
    return env[key] as string;
  }
  // Fallback for local dev / Node.js
  if (typeof globalThis.process !== 'undefined') {
    return globalThis.process.env?.[key] || undefined;
  }
  return undefined;
}
