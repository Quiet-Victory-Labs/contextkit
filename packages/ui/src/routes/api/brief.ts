import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stringify } from 'yaml';
import { validateBrief } from '@runcontext/core';

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
    return c.json({ ok: true, path: path.join(productDir, 'context-brief.yaml') });
  });

  app.get('/api/brief/:name', async (c) => {
    const briefPath = path.join(contextDir, 'products', c.req.param('name'), 'context-brief.yaml');
    if (!fs.existsSync(briefPath)) return c.json({ error: 'Not found' }, 404);
    const { parse } = await import('yaml');
    return c.json(parse(fs.readFileSync(briefPath, 'utf-8')));
  });

  return app;
}
