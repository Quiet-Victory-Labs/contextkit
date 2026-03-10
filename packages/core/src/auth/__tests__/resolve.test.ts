import { describe, it, expect, vi } from 'vitest';
import { resolveAuthConnection } from '../resolve.js';
import { CredentialStore } from '../credential-store.js';
import { ProviderRegistry } from '../registry.js';
import type { AuthProvider } from '../types.js';

vi.mock('../credential-store.js');

describe('resolveAuthConnection', () => {
  it('resolves auth key to a connection string', async () => {
    const store = new CredentialStore();
    vi.mocked(store.load).mockResolvedValue({
      provider: 'neon',
      key: 'neon:ep-test',
      token: 'secret',
      metadata: { host: 'ep-test.neon.tech', database: 'mydb' },
    });

    const provider: AuthProvider = {
      id: 'neon',
      displayName: 'Neon',
      adapters: ['postgres'],
      authenticate: async () => ({ ok: true, provider: 'neon', token: 't' }),
      listDatabases: async () => [],
      getConnectionString: async (db) => `postgresql://token:secret@${db.host}/${db.name}`,
      detectCli: async () => ({ installed: false, authenticated: false }),
      validateCredentials: async () => true,
    };

    const registry = new ProviderRegistry();
    registry.register(provider);

    const connStr = await resolveAuthConnection('neon:ep-test', registry, store);
    expect(connStr).toContain('postgresql://');
  });

  it('throws when credential not found', async () => {
    const store = new CredentialStore();
    vi.mocked(store.load).mockResolvedValue(null);

    const registry = new ProviderRegistry();

    await expect(resolveAuthConnection('neon:missing', registry, store))
      .rejects.toThrow('No stored credential');
  });

  it('throws when provider not registered', async () => {
    const store = new CredentialStore();
    vi.mocked(store.load).mockResolvedValue({
      provider: 'unknown',
      key: 'unknown:db',
      token: 'x',
    });

    const registry = new ProviderRegistry();

    await expect(resolveAuthConnection('unknown:db', registry, store))
      .rejects.toThrow('No auth provider');
  });
});
