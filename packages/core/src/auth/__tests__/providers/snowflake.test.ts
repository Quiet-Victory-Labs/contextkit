import { describe, it, expect, vi } from 'vitest';
import { SnowflakeProvider } from '../../providers/snowflake.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

describe('SnowflakeProvider', () => {
  const provider = new SnowflakeProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('snowflake');
    expect(provider.adapters).toEqual(['snowflake']);
  });

  it('detectCli returns installed:false when snowsql not found', async () => {
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
      id: 'my-snowflake-db',
      name: 'ANALYTICS',
      adapter: 'snowflake',
      metadata: { account: 'xy12345.us-east-1', user: 'MYUSER', warehouse: 'COMPUTE_WH' },
    });
    expect(url).toContain('snowflake://');
    expect(url).toContain('ANALYTICS');
    expect(url).toContain('xy12345');
    expect(url).toContain('externalbrowser');
  });

  it('validateCredentials always returns false (browser SSO on-demand)', async () => {
    const result = await provider.validateCredentials({
      provider: 'snowflake',
      key: 'snowflake:test',
      token: 'browser-sso',
    });
    expect(result).toBe(false);
  });
});
