import { describe, it, expect } from 'vitest';
import { contextKitConfigSchema } from '../../schema/config.js';

describe('data_sources config', () => {
  it('accepts valid duckdb data source', () => {
    const config = contextKitConfigSchema.parse({
      data_sources: {
        warehouse: { adapter: 'duckdb', path: './data.duckdb' },
      },
    });
    expect(config.data_sources!['warehouse']!.adapter).toBe('duckdb');
    expect(config.data_sources!['warehouse']!.path).toBe('./data.duckdb');
  });

  it('accepts valid postgres data source', () => {
    const config = contextKitConfigSchema.parse({
      data_sources: {
        analytics: { adapter: 'postgres', connection: 'postgresql://localhost/db' },
      },
    });
    expect(config.data_sources!['analytics']!.adapter).toBe('postgres');
  });

  it('accepts multiple data sources', () => {
    const config = contextKitConfigSchema.parse({
      data_sources: {
        a: { adapter: 'duckdb', path: './a.duckdb' },
        b: { adapter: 'postgres', connection: 'postgresql://localhost/b' },
      },
    });
    expect(Object.keys(config.data_sources!)).toHaveLength(2);
  });

  it('config without data_sources still works', () => {
    const config = contextKitConfigSchema.parse({});
    expect(config.data_sources).toBeUndefined();
  });

  it('rejects unknown adapter type', () => {
    expect(() =>
      contextKitConfigSchema.parse({
        data_sources: { x: { adapter: 'oracle' } },
      }),
    ).toThrow();
  });
});
