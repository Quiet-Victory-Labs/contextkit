import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stringify, parse } from 'yaml';
import { validateBrief, ContextBriefSchema, PRODUCT_NAME_RE } from '@runcontext/core';

export function briefRoutes(contextDir: string): Hono {
  const app = new Hono();

  app.post('/api/brief', async (c) => {
    const body = await c.req.json();
    const validation = validateBrief(body);
    if (!validation.ok) {
      return c.json({ error: 'Invalid brief', details: validation.errors }, 400);
    }
    const brief = ContextBriefSchema.parse(body);
    brief.created_at = brief.created_at || new Date().toISOString();
    const briefPath = path.join(contextDir, `${brief.product_name}.context-brief.yaml`);
    fs.writeFileSync(briefPath, stringify(brief), 'utf-8');
    return c.json({ ok: true, path: `${brief.product_name}.context-brief.yaml` });
  });

  app.get('/api/brief/:name', async (c) => {
    const name = c.req.param('name');
    if (!PRODUCT_NAME_RE.test(name)) {
      return c.json({ error: 'Invalid product name' }, 400);
    }
    const briefPath = path.join(contextDir, `${name}.context-brief.yaml`);
    if (!fs.existsSync(briefPath)) return c.json({ error: 'Not found' }, 404);
    return c.json(parse(fs.readFileSync(briefPath, 'utf-8')));
  });

  return app;
}
