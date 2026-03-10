import { describe, it, expect, vi } from 'vitest';
import { AzureSqlProvider } from '../../providers/azure-sql.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
}));

describe('AzureSqlProvider', () => {
  const provider = new AzureSqlProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('azure-sql');
    expect(provider.adapters).toContain('postgres');
    expect(provider.adapters).toContain('mssql');
  });

  it('detectCli returns installed:false when az not found', async () => {
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
      id: 'mydb.database.windows.net',
      name: 'mydb',
      host: 'myserver.database.windows.net',
      port: 5432,
      adapter: 'postgres',
      metadata: { user: 'admin', token: 'azure-token-123' },
    });
    expect(url).toContain('postgresql://');
    expect(url).toContain('mydb');
    expect(url).toContain('myserver.database.windows.net');
  });

  it('validateCredentials returns false for expired token', async () => {
    const result = await provider.validateCredentials({
      provider: 'azure-sql',
      key: 'azure-sql:test',
      token: 'expired',
      expiresAt: '2020-01-01T00:00:00Z',
    });
    expect(result).toBe(false);
  });
});
