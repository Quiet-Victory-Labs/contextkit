import { describe, it, expect, vi } from 'vitest';
import { NeonProvider } from '../../providers/neon.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
}));

describe('NeonProvider', () => {
  const provider = new NeonProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('neon');
    expect(provider.adapters).toEqual(['postgres']);
  });

  it('detectCli returns installed:false when neonctl not found', async () => {
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
      id: 'ep-red-rain-a4sny153',
      name: 'neondb',
      host: 'ep-red-rain-a4sny153-pooler.us-east-1.aws.neon.tech',
      adapter: 'postgres',
      metadata: { user: 'neondb_owner', token: 'neon_token_123' },
    });
    expect(url).toContain('postgresql://');
    expect(url).toContain('neondb');
    expect(url).toContain('ep-red-rain');
  });

  it('validateCredentials returns false for expired token', async () => {
    const result = await provider.validateCredentials({
      provider: 'neon',
      key: 'neon:test',
      token: 'expired',
      expiresAt: '2020-01-01T00:00:00Z',
    });
    expect(result).toBe(false);
  });
});
