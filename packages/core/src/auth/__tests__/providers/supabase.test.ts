import { describe, it, expect, vi } from 'vitest';
import { SupabaseProvider } from '../../providers/supabase.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

describe('SupabaseProvider', () => {
  const provider = new SupabaseProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('supabase');
    expect(provider.adapters).toEqual(['postgres']);
  });

  it('detectCli returns installed:false when supabase not found', async () => {
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
      id: 'my-project',
      name: 'postgres',
      host: 'db.abcdef.supabase.co',
      port: 5432,
      adapter: 'postgres',
      metadata: { user: 'postgres', token: 'supabase-token-123' },
    });
    expect(url).toContain('postgresql://');
    expect(url).toContain('postgres');
    expect(url).toContain('supabase.co');
  });

  it('validateCredentials returns false for expired token', async () => {
    const result = await provider.validateCredentials({
      provider: 'supabase',
      key: 'supabase:test',
      token: 'expired',
      expiresAt: '2020-01-01T00:00:00Z',
    });
    expect(result).toBe(false);
  });
});
