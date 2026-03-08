import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stringify, parse } from 'yaml';
import { validateBrief } from '@runcontext/core';

const PRODUCT_NAME_RE = /^[a-zA-Z0-9_-]+$/;

export function briefRoutes(contextDir: string): Hono {
  const app = new Hono();

  app.post('/api/brief', async (c) => {
    const body = await c.req.json();
    const validation = validateBrief(body);
    if (!validation.ok) {
      return c.json({ error: 'Invalid brief', details: validation.errors }, 400);
    }
    body.created_at = body.created_at || new Date().toISOString();
    const productDir = path.join(contextDir, 'products', body.product_name);
    fs.mkdirSync(productDir, { recursive: true });
    fs.writeFileSync(path.join(productDir, 'context-brief.yaml'), stringify(body), 'utf-8');
    return c.json({ ok: true, path: `products/${body.product_name}/context-brief.yaml` });
  });

  app.get('/api/brief/:name', async (c) => {
    const name = c.req.param('name');
    if (!PRODUCT_NAME_RE.test(name)) {
      return c.json({ error: 'Invalid product name' }, 400);
    }
    const briefPath = path.join(contextDir, 'products', name, 'context-brief.yaml');
    if (!fs.existsSync(briefPath)) return c.json({ error: 'Not found' }, 404);
    return c.json(parse(fs.readFileSync(briefPath, 'utf-8')));
  });

  return app;
}
