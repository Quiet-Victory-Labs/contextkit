import { describe, it, expect } from 'vitest';
import { ClickHouseProvider } from '../../providers/clickhouse.js';

describe('ClickHouseProvider', () => {
  const provider = new ClickHouseProvider();

  it('has correct id and adapters', () => {
    expect(provider.id).toBe('clickhouse');
    expect(provider.adapters).toEqual(['clickhouse']);
  });

  // ClickHouse has no CLI — detectCli always returns installed:false
  it('detectCli always returns installed:false (no CLI)', async () => {
    const result = await provider.detectCli();
    expect(result.installed).toBe(false);
  });

  it('getConnectionString builds correct URL', async () => {
    const url = await provider.getConnectionString({
      id: 'my-clickhouse',
      name: 'analytics',
      host: 'ch-cluster.example.com',
      port: 8443,
      adapter: 'clickhouse',
      metadata: { user: 'default', token: 'ch-password-123' },
    });
    expect(url).toContain('clickhouse://');
    expect(url).toContain('analytics');
    expect(url).toContain('8443');
    expect(url).toContain('secure=true');
  });

  it('validateCredentials returns false for expired token', async () => {
    const result = await provider.validateCredentials({
      provider: 'clickhouse',
      key: 'clickhouse:test',
      token: 'expired',
      expiresAt: '2020-01-01T00:00:00Z',
    });
    expect(result).toBe(false);
  });
});
