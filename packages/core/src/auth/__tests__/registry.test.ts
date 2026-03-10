import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../registry.js';
import type { AuthProvider } from '../types.js';

function mockProvider(id: string): AuthProvider {
  return {
    id,
    displayName: id.toUpperCase(),
    adapters: ['postgres'],
    authenticate: async () => ({ ok: true, provider: id, token: 'tok' }),
    listDatabases: async () => [],
    getConnectionString: async () => `postgresql://localhost/${id}`,
    detectCli: async () => ({ installed: false, authenticated: false }),
    validateCredentials: async () => false,
  };
}

describe('ProviderRegistry', () => {
  it('registers and retrieves a provider', () => {
    const reg = new ProviderRegistry();
    reg.register(mockProvider('neon'));
    expect(reg.get('neon')).toBeDefined();
    expect(reg.get('neon')!.displayName).toBe('NEON');
  });

  it('returns undefined for unknown provider', () => {
    const reg = new ProviderRegistry();
    expect(reg.get('unknown')).toBeUndefined();
  });

  it('lists all registered providers', () => {
    const reg = new ProviderRegistry();
    reg.register(mockProvider('neon'));
    reg.register(mockProvider('supabase'));
    const ids = reg.listIds();
    expect(ids).toContain('neon');
    expect(ids).toContain('supabase');
  });

  it('getAll returns all providers', () => {
    const reg = new ProviderRegistry();
    reg.register(mockProvider('neon'));
    reg.register(mockProvider('aws-rds'));
    expect(reg.getAll()).toHaveLength(2);
  });
});
