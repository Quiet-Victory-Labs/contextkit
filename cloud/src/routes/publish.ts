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
publish.post('/api/publish', requireAuth, async (c) => {
  const body = await c.req.json<{
    org?: string;
    manifest?: Record<string, unknown>;
    files?: Array<{ path: string; content: string }>;
  }>();

  if (!body.org || typeof body.org !== 'string') {
    return c.json({ error: 'Missing required field: org' }, 400);
  }

  if (!body.manifest || typeof body.manifest !== 'object') {
    return c.json({ error: 'Missing required field: manifest' }, 400);
  }

  if (!Array.isArray(body.files)) {
    return c.json({ error: 'Missing required field: files' }, 400);
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
