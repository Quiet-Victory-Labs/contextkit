import type { Context, Next } from 'hono';

/**
 * Simple bearer token auth middleware.
 *
 * Validates that an Authorization header is present with a truthy token.
 * Real Clerk-based auth will replace this in Task 10.
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

  // Store the token for downstream handlers if needed
  c.set('apiKey', token);

  await next();
}
