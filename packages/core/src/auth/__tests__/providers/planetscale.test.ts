import { describe, it, expect, vi } from 'vitest';
import { PlanetScaleProvider } from '../../providers/planetscale.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

describe('PlanetScaleProvider', () => {
  const provider = new PlanetScaleProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('planetscale');
    expect(provider.adapters).toEqual(['mysql']);
  });

  it('detectCli returns installed:false when pscale not found', async () => {
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
      id: 'my-ps-db',
      name: 'mydb',
      host: 'aws.connect.psdb.cloud',
      port: 3306,
      adapter: 'mysql',
      metadata: { user: 'root', token: 'pscale-token-123' },
    });
    expect(url).toContain('mysql://');
    expect(url).toContain('mydb');
    expect(url).toContain('psdb.cloud');
  });

  it('validateCredentials returns false for expired token', async () => {
    const result = await provider.validateCredentials({
      provider: 'planetscale',
      key: 'planetscale:test',
      token: 'expired',
      expiresAt: '2020-01-01T00:00:00Z',
    });
    expect(result).toBe(false);
  });
});
