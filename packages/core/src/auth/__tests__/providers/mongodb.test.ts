import { describe, it, expect, vi } from 'vitest';
import { MongoDbProvider } from '../../providers/mongodb.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

describe('MongoDbProvider', () => {
  const provider = new MongoDbProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('mongodb');
    expect(provider.adapters).toHaveLength(1);
  });

  it('detectCli returns installed:false when atlas not found', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation((_cmd, _args, cb: any) => {
      cb(new Error('not found'), '', '');
      return {} as any;
    });
    const result = await provider.detectCli();
    expect(result.installed).toBe(false);
  });

  it('getConnectionString builds correct URL', async () => {
    const url = await provider.getConnectionString({
      id: 'my-cluster',
      name: 'mydb',
      host: 'cluster0.abc123.mongodb.net',
      adapter: 'sqlite' as any,
      metadata: { user: 'admin', token: 'mongo-token-123' },
    });
    expect(url).toContain('mongodb+srv://');
    expect(url).toContain('mydb');
    expect(url).toContain('mongodb.net');
  });

  it('validateCredentials returns false for expired token', async () => {
    const result = await provider.validateCredentials({
      provider: 'mongodb',
      key: 'mongodb:test',
      token: 'expired',
      expiresAt: '2020-01-01T00:00:00Z',
    });
    expect(result).toBe(false);
  });
});
