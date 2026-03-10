import { Hono } from 'hono';
import {
  createDefaultRegistry,
  CredentialStore,
} from '@runcontext/core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export function authRoutes(rootDir: string): Hono {
  const app = new Hono();
  const registry = createDefaultRegistry();
  const store = new CredentialStore();

  // List all supported providers with CLI detection status
  app.get('/api/auth/providers', async (c) => {
    const providers = await Promise.all(
      registry.getAll().map(async (p) => {
        const cli = await p.detectCli();
        return {
          id: p.id,
          displayName: p.displayName,
          adapters: p.adapters,
          cliInstalled: cli.installed,
          cliAuthenticated: cli.authenticated,
        };
      }),
    );
    return c.json(providers);
  });

  // Start authentication with a provider
  app.post('/api/auth/start', async (c) => {
    const { provider: providerId } = await c.req.json();
    const provider = registry.get(providerId);
    if (!provider) {
      return c.json({ error: `Unknown provider: ${providerId}` }, 400);
    }

    const result = await provider.authenticate();
    if (!result.ok) {
      return c.json({ error: result.error }, 401);
    }

    // List databases after successful auth
    const databases = await provider.listDatabases();

    return c.json({
      ok: true,
      provider: providerId,
      databases,
    });
  });

  // Select a database and save credentials
  app.post('/api/auth/select-db', async (c) => {
    const { provider: providerId, database } = await c.req.json();
    const provider = registry.get(providerId);
    if (!provider) {
      return c.json({ error: `Unknown provider: ${providerId}` }, 400);
    }

    // Re-authenticate to get a fresh token
    const authResult = await provider.authenticate();
    if (!authResult.ok) {
      return c.json({ error: authResult.error }, 401);
    }

    // Build and test connection
    database.metadata = { ...database.metadata, token: authResult.token };
    const connStr = await provider.getConnectionString(database);

    try {
      const { createAdapter } = await import('@runcontext/core');
      const adapter = await createAdapter({
        adapter: database.adapter,
        connection: connStr,
      });
      await adapter.connect();
      await adapter.query('SELECT 1');
      await adapter.disconnect();
    } catch (err) {
      return c.json({ error: `Connection failed: ${(err as Error).message}` }, 400);
    }

    // Save credential
    const credKey = `${providerId}:${database.id}`;
    await store.save({
      provider: providerId,
      key: credKey,
      token: authResult.token,
      refreshToken: authResult.ok ? authResult.refreshToken : undefined,
      expiresAt: authResult.ok ? authResult.expiresAt : undefined,
      metadata: {
        host: database.host,
        database: database.name,
        ...database.metadata,
        token: undefined,
      },
    });

    // Update config
    const configPath = path.join(rootDir, 'runcontext.config.yaml');
    let config: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
      try {
        config = parseYaml(fs.readFileSync(configPath, 'utf-8')) ?? {};
      } catch { /* start fresh */ }
    }
    config.data_sources = config.data_sources ?? {};
    config.data_sources.default = { adapter: database.adapter, auth: credKey };
    fs.writeFileSync(configPath, stringifyYaml(config), 'utf-8');

    return c.json({ ok: true, auth: credKey });
  });

  // List stored credentials
  app.get('/api/auth/credentials', async (c) => {
    const keys = await store.list();
    return c.json(keys);
  });

  return app;
}
