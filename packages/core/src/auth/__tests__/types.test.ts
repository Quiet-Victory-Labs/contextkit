import { describe, it, expect } from 'vitest';
import type {
  AuthProvider,
  AuthResult,
  DatabaseEntry,
  StoredCredential,
} from '../types.js';

describe('auth types', () => {
  it('AuthResult discriminated union works', () => {
    const success: AuthResult = {
      ok: true,
      provider: 'neon',
      token: 'test-token',
      expiresAt: new Date().toISOString(),
    };
    expect(success.ok).toBe(true);

    const failure: AuthResult = {
      ok: false,
      error: 'cancelled',
    };
    expect(failure.ok).toBe(false);
  });

  it('DatabaseEntry has required fields', () => {
    const db: DatabaseEntry = {
      id: 'ep-red-rain-a4sny153',
      name: 'neondb',
      host: 'ep-red-rain-a4sny153.us-east-1.aws.neon.tech',
      adapter: 'postgres',
    };
    expect(db.id).toBe('ep-red-rain-a4sny153');
    expect(db.adapter).toBe('postgres');
  });

  it('StoredCredential has provider and key', () => {
    const cred: StoredCredential = {
      provider: 'neon',
      key: 'neon:ep-red-rain-a4sny153',
      token: 'neon_oauth_token_abc',
      expiresAt: '2026-03-10T00:00:00Z',
      metadata: { project: 'saber-alert-sandbox', database: 'neondb' },
    };
    expect(cred.key).toBe('neon:ep-red-rain-a4sny153');
  });

  it('AuthProvider interface shape is implementable', () => {
    // Verify the interface is structurally sound by creating a mock
    const mock: AuthProvider = {
      id: 'test',
      displayName: 'Test Provider',
      adapters: ['postgres'],
      authenticate: async () => ({ ok: true, provider: 'test', token: 't' }),
      listDatabases: async () => [],
      getConnectionString: async () => 'postgresql://localhost/test',
      detectCli: async () => ({ installed: false, authenticated: false }),
      validateCredentials: async () => false,
    };
    expect(mock.id).toBe('test');
  });
});
