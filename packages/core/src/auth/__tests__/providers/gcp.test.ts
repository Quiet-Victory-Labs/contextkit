import { describe, it, expect, vi } from 'vitest';
import { GcpProvider } from '../../providers/gcp.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
}));

describe('GcpProvider', () => {
  const provider = new GcpProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('gcp');
    expect(provider.adapters).toContain('postgres');
    expect(provider.adapters).toContain('mysql');
  });

  it('detectCli returns installed:false when gcloud not found', async () => {
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
      id: 'my-instance',
      name: 'mydb',
      host: '10.0.0.1',
      port: 5432,
      adapter: 'postgres',
      metadata: { user: 'root', token: 'gcp-token-123' },
    });
    expect(url).toContain('postgresql://');
    expect(url).toContain('mydb');
  });

  it('validateCredentials always returns false (tokens are short-lived)', async () => {
    const result = await provider.validateCredentials({
      provider: 'gcp',
      key: 'gcp:my-instance',
      token: 'some-token',
    });
    expect(result).toBe(false);
  });
});
