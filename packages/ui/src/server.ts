import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';

export interface UIServerOptions {
  rootDir: string;
  contextDir: string;
  port: number;
  host: string;
}

export function createApp(opts: UIServerOptions): Hono {
  const app = new Hono();

  app.use('*', cors());

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/setup', (c) => {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ContextKit — Build Your Data Product</title>
</head>
<body>
  <h1>ContextKit Setup</h1>
  <p>Build your data product. AI handles the rest.</p>
</body>
</html>`);
  });

  app.get('/', (c) => c.redirect('/setup'));

  return app;
}

export async function startUIServer(opts: UIServerOptions): Promise<void> {
  const app = createApp(opts);

  serve({
    fetch: app.fetch,
    port: opts.port,
    hostname: opts.host,
  }, (info) => {
    console.log(`ContextKit UI running at http://${opts.host === '0.0.0.0' ? 'localhost' : opts.host}:${info.port}/setup`);
  });
}
