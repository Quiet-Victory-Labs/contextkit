import { describe, it, expect } from 'vitest';
import { createAdapter } from '../index.js';

describe('createAdapter', () => {
  it('throws on unknown adapter type', async () => {
    await expect(
      createAdapter({ adapter: 'oracle' as any }),
    ).rejects.toThrow('Unknown adapter: oracle');
  });

  it('throws when duckdb config missing path', async () => {
    await expect(
      createAdapter({ adapter: 'duckdb' }),
    ).rejects.toThrow('DuckDB adapter requires "path"');
  });

  it('throws when postgres config missing connection', async () => {
    await expect(
      createAdapter({ adapter: 'postgres' }),
    ).rejects.toThrow('Postgres adapter requires "connection"');
  });
});
