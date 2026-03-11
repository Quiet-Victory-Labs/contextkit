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

    // First, try listing databases without full re-auth.
    // If the provider already has valid stored credentials (e.g. "CLI authenticated"),
    // this avoids re-running neonctl auth which can open a broken OAuth browser window.
    try {
      const databases = await provider.listDatabases();
      if (databases.length > 0) {
        return c.json({ ok: true, provider: providerId, databases });
      }
    } catch { /* fall through to full authenticate */ }

    // Full authentication flow (may open browser for OAuth)
    const result = await provider.authenticate();
    if (!result.ok) {
      return c.json({ error: result.error }, 401);
    }

    // List databases after successful auth — pass the fresh token
    const databases = await provider.listDatabases(result.token);

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

    // Use token from database metadata (set during listDatabases) or re-authenticate
    let token = database.metadata?.token as string | undefined;
    if (!token) {
      const authResult = await provider.authenticate();
      if (!authResult.ok) {
        return c.json({ error: authResult.error }, 401);
      }
      token = authResult.token;
    }

    // Build and test connection
    database.metadata = { ...database.metadata, token };
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
      token: token!,
      refreshToken: undefined,
      expiresAt: undefined,
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
    // Remove stale entries (e.g. auth-only refs without connection strings)
    const existingSources = config.data_sources ?? {};
    for (const [key, val] of Object.entries(existingSources)) {
      if (val && typeof val === 'object' && !(val as any).connection && !(val as any).path) {
        delete existingSources[key];
      }
    }
    config.data_sources = existingSources;
    const sourceName = (database.name || database.database || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    config.data_sources[sourceName] = { adapter: database.adapter, connection: connStr };
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
