import type { Context } from 'hono';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Authenticated user info extracted from a Clerk JWT or fallback token. */
export interface AuthUser {
  /** Clerk user ID (e.g. "user_abc123") or "anonymous" for simple bearer auth. */
  userId: string;
  /** Clerk organization ID, if present. */
  orgId?: string;
  /** Clerk organization slug, if present. */
  orgSlug?: string;
  /** User email from JWT claims, if present. */
  email?: string;
}

/** Standard Clerk JWT payload claims we care about. */
interface ClerkJwtPayload {
  sub: string; // user ID
  org_id?: string;
  org_slug?: string;
  email?: string;
  azp?: string; // authorized party
  exp: number;
  iat: number;
  nbf?: number;
  iss?: string;
}

/** A single key from Clerk's JWKS endpoint. */
interface JwksKey {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n: string;
  e: string;
}

// ---------------------------------------------------------------------------
// JWKS cache
// ---------------------------------------------------------------------------

let jwksCache: Map<string, CryptoKey> = new Map();
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Context key for storing the auth user
// ---------------------------------------------------------------------------

const AUTH_USER_KEY = 'authUser';

/**
 * Retrieve the authenticated user from the Hono context.
 * Returns undefined if no auth user was set (i.e. public route).
 */
export function getAuthUser(c: Context): AuthUser | undefined {
  return c.get(AUTH_USER_KEY) as AuthUser | undefined;
}

/**
 * Store the authenticated user on the Hono context.
 */
export function setAuthUser(c: Context, user: AuthUser): void {
  c.set(AUTH_USER_KEY, user);
}

// ---------------------------------------------------------------------------
// JWT verification (Clerk-compatible, Workers-safe)
// ---------------------------------------------------------------------------

/**
 * Decode a JWT without verification. Returns header + payload.
 * Throws if the token is malformed.
 */
export function decodeJwt(token: string): { header: Record<string, unknown>; payload: ClerkJwtPayload } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT: expected 3 parts');
  }

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1])) as ClerkJwtPayload;
  return { header, payload };
}

/** Base64url decode to UTF-8 string. */
function base64UrlDecode(str: string): string {
  // Pad to multiple of 4
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Fetch Clerk's JWKS keys and import them as CryptoKey objects.
 * Uses the CLERK_SECRET_KEY to derive the Clerk frontend API domain,
 * or falls back to the issuer from the JWT.
 */
async function fetchJwks(issuer: string): Promise<Map<string, CryptoKey>> {
  const now = Date.now();
  if (jwksCache.size > 0 && now < jwksCacheExpiry) {
    return jwksCache;
  }

  // Clerk JWKS endpoint is always at {issuer}/.well-known/jwks.json
  const jwksUrl = `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;

  const resp = await fetch(jwksUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUrl}: ${resp.status}`);
  }

  const data = (await resp.json()) as { keys: JwksKey[] };
  const newCache = new Map<string, CryptoKey>();

  for (const key of data.keys) {
    if (key.kty !== 'RSA') continue;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      { kty: key.kty, n: key.n, e: key.e, alg: key.alg ?? 'RS256' },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    newCache.set(key.kid, cryptoKey);
  }

  jwksCache = newCache;
  jwksCacheExpiry = now + JWKS_CACHE_TTL_MS;

  return newCache;
}

/**
 * Verify a Clerk JWT token using JWKS.
 *
 * 1. Decodes the JWT header to get the `kid`.
 * 2. Fetches the JWKS keys from Clerk (cached).
 * 3. Verifies the RSA signature using the WebCrypto API.
 * 4. Validates exp, nbf, and iat claims.
 *
 * Returns the extracted AuthUser on success.
 * Throws on any verification failure.
 */
export async function verifyClerkToken(token: string): Promise<AuthUser> {
  const { header, payload } = decodeJwt(token);

  // Validate required fields
  if (!payload.sub) {
    throw new Error('JWT missing sub claim');
  }
  if (!payload.iss) {
    throw new Error('JWT missing iss claim');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) {
    throw new Error('JWT has expired');
  }
  if (payload.nbf && now < payload.nbf) {
    throw new Error('JWT not yet valid (nbf)');
  }

  // Get the signing key
  const kid = header.kid as string;
  if (!kid) {
    throw new Error('JWT header missing kid');
  }

  const keys = await fetchJwks(payload.iss);
  const signingKey = keys.get(kid);
  if (!signingKey) {
    // Retry once in case keys were rotated
    jwksCacheExpiry = 0;
    const refreshedKeys = await fetchJwks(payload.iss);
    const refreshedKey = refreshedKeys.get(kid);
    if (!refreshedKey) {
      throw new Error(`No matching JWKS key found for kid: ${kid}`);
    }
    await verifySignature(token, refreshedKey);
  } else {
    await verifySignature(token, signingKey);
  }

  return {
    userId: payload.sub,
    orgId: payload.org_id,
    orgSlug: payload.org_slug,
    email: payload.email,
  };
}

/** Verify the RSA-SHA256 signature of a JWT using the WebCrypto API. */
async function verifySignature(token: string, key: CryptoKey): Promise<void> {
  const parts = token.split('.');
  const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

  // Decode the signature from base64url
  let sig = parts[2].replace(/-/g, '+').replace(/_/g, '/');
  while (sig.length % 4 !== 0) {
    sig += '=';
  }
  const signatureBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signatureBytes,
    signedContent,
  );

  if (!valid) {
    throw new Error('JWT signature verification failed');
  }
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

/** Reset the JWKS cache. Exported for tests. */
export function _resetJwksCache(): void {
  jwksCache = new Map();
  jwksCacheExpiry = 0;
}
