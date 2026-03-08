import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PRODUCT_NAME_RE } from '@runcontext/core';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.md', '.txt', '.pdf', '.csv', '.json', '.yaml', '.yml', '.sql', '.html'];

export function uploadRoutes(contextDir: string): Hono {
  const app = new Hono();

  app.post('/api/upload/:productName', async (c) => {
    const productName = c.req.param('productName');
    if (!PRODUCT_NAME_RE.test(productName)) {
      return c.json({ error: 'Invalid product name' }, 400);
    }

    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File too large (max 10MB)' }, 400);
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return c.json({ error: `File type ${ext} not allowed` }, 400);
    }

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const docsDir = path.join(contextDir, 'products', productName, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(docsDir, safeName), buffer);

    return c.json({ ok: true, filename: safeName });
  });

  return app;
}
