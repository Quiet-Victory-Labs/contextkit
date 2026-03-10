import { describe, it, expect, vi } from 'vitest';
import { DatabricksProvider } from '../../providers/databricks.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

describe('DatabricksProvider', () => {
  const provider = new DatabricksProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('databricks');
    expect(provider.adapters).toEqual(['databricks']);
  });

  it('detectCli returns installed:false when databricks not found', async () => {
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
      id: 'my-workspace',
      name: 'default',
      host: 'adb-1234567890.1.azuredatabricks.net',
      adapter: 'databricks',
      metadata: { token: 'dapi-token-123', httpPath: '/sql/1.0/warehouses/abc' },
    });
    expect(url).toContain('databricks://');
    expect(url).toContain('azuredatabricks.net');
    expect(url).toContain('443');
  });

  it('validateCredentials returns false for expired token', async () => {
    const result = await provider.validateCredentials({
      provider: 'databricks',
      key: 'databricks:test',
      token: 'expired',
      expiresAt: '2020-01-01T00:00:00Z',
    });
    expect(result).toBe(false);
  });
});
