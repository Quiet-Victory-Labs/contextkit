import { describe, it, expect, vi } from 'vitest';
import { AwsRdsProvider } from '../../providers/aws-rds.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

describe('AwsRdsProvider', () => {
  const provider = new AwsRdsProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('aws-rds');
    expect(provider.adapters).toContain('postgres');
    expect(provider.adapters).toContain('mysql');
  });

  it('detectCli returns installed:false when aws not found', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation((_cmd, _args, cb: any) => {
      cb(new Error('not found'), '', '');
      return {} as any;
    });
    const result = await provider.detectCli();
    expect(result.installed).toBe(false);
  });

  it('validateCredentials always returns false (IAM tokens are on-demand)', async () => {
    const result = await provider.validateCredentials({
      provider: 'aws-rds',
      key: 'aws-rds:us-east-1:mydb',
      metadata: { region: 'us-east-1' },
    });
    expect(result).toBe(false);
  });

  it('getConnectionString builds correct URL', async () => {
    const url = await provider.getConnectionString({
      id: 'mydb.abc123.us-east-1.rds.amazonaws.com',
      name: 'mydb',
      host: 'mydb.abc123.us-east-1.rds.amazonaws.com',
      port: 5432,
      adapter: 'postgres',
      metadata: { user: 'iam_user', token: 'iam-auth-token-123' },
    });
    expect(url).toContain('postgresql://');
    expect(url).toContain('mydb');
  });
});
