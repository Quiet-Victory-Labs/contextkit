import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { storage } from '../storage.js';

const publish = new Hono();

/**
 * POST /api/publish
 *
 * Receives a semantic plane from the CLI and stores it.
 * Expects JSON body: { org: string, manifest: object, files: Array<{ path, content }> }
 */
const ORG_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_FILES = 500;

publish.post('/api/publish', requireAuth, async (c) => {
  let body: {
    org?: string;
    manifest?: Record<string, unknown>;
    files?: Array<{ path: string; content: string }>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.org || typeof body.org !== 'string') {
    return c.json({ error: 'Missing required field: org' }, 400);
  }

  if (!ORG_SLUG_RE.test(body.org)) {
    return c.json({ error: 'org must be a lowercase slug (letters, numbers, hyphens, max 64 chars)' }, 400);
  }

  if (!body.manifest || typeof body.manifest !== 'object') {
    return c.json({ error: 'Missing required field: manifest' }, 400);
  }

  if (!Array.isArray(body.files)) {
    return c.json({ error: 'Missing required field: files' }, 400);
  }

  if (body.files.length > MAX_FILES) {
    return c.json({ error: `Too many files (max ${MAX_FILES})` }, 400);
  }

  const version = storage.putPlane(body.org, body.manifest, body.files);

  return c.json(
    {
      ok: true,
      version: String(version),
      url: `https://plane.runcontext.dev/${body.org}`,
    },
    201,
  );
});

export { publish };
