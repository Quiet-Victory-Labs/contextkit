import { describe, it, expect, vi } from 'vitest';
import { CockroachDbProvider } from '../../providers/cockroachdb.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

describe('CockroachDbProvider', () => {
  const provider = new CockroachDbProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('cockroachdb');
    expect(provider.adapters).toEqual(['postgres']);
  });

  it('detectCli returns installed:false when ccloud not found', async () => {
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
      id: 'my-crdb',
      name: 'defaultdb',
      host: 'my-cluster-abc.cockroachlabs.cloud',
      port: 26257,
      adapter: 'postgres',
      metadata: { user: 'root', token: 'crdb-token-123' },
    });
    expect(url).toContain('postgresql://');
    expect(url).toContain('defaultdb');
    expect(url).toContain('26257');
  });

  it('validateCredentials returns false for expired token', async () => {
    const result = await provider.validateCredentials({
      provider: 'cockroachdb',
      key: 'cockroachdb:test',
      token: 'expired',
      expiresAt: '2020-01-01T00:00:00Z',
    });
    expect(result).toBe(false);
  });
});
