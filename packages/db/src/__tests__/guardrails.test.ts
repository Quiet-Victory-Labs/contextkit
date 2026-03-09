import { describe, it, expect } from 'vitest';
import { enforceReadOnly, applyRowLimit, applyTimeout } from '../guardrails.js';

describe('enforceReadOnly', () => {
  it('returns SET default_transaction_read_only for postgres', () => {
    expect(enforceReadOnly('postgres')).toBe('SET default_transaction_read_only = ON');
  });

  it('returns SET SESSION TRANSACTION READ ONLY for mysql', () => {
    expect(enforceReadOnly('mysql')).toBe('SET SESSION TRANSACTION READ ONLY');
  });

  it('returns SET readonly = 1 for clickhouse', () => {
    expect(enforceReadOnly('clickhouse')).toBe('SET readonly = 1');
  });

  it('returns PRAGMA query_only = ON for sqlite', () => {
    expect(enforceReadOnly('sqlite')).toBe('PRAGMA query_only = ON');
  });

  it('returns null for snowflake (role-based)', () => {
    expect(enforceReadOnly('snowflake')).toBeNull();
  });

  it('returns null for bigquery (read-only by default)', () => {
    expect(enforceReadOnly('bigquery')).toBeNull();
  });

  it('returns null for databricks (role-based)', () => {
    expect(enforceReadOnly('databricks')).toBeNull();
  });
});

describe('applyRowLimit', () => {
  it('adds LIMIT to a simple query', () => {
    const result = applyRowLimit('SELECT * FROM users', 50);
    expect(result).toBe('SELECT * FROM users\nLIMIT 50');
  });

  it('strips trailing semicolons before adding LIMIT', () => {
    const result = applyRowLimit('SELECT * FROM users;', 50);
    expect(result).toBe('SELECT * FROM users\nLIMIT 50');
  });

  it('replaces existing LIMIT with lower value', () => {
    const result = applyRowLimit('SELECT * FROM users LIMIT 200', 100);
    expect(result).toBe('SELECT * FROM users LIMIT 100');
  });

  it('keeps existing LIMIT if it is lower than cap', () => {
    const result = applyRowLimit('SELECT * FROM users LIMIT 10', 100);
    expect(result).toBe('SELECT * FROM users LIMIT 10');
  });

  it('handles case-insensitive LIMIT', () => {
    const result = applyRowLimit('SELECT * FROM users limit 200', 100);
    expect(result).toBe('SELECT * FROM users LIMIT 100');
  });
});

describe('applyTimeout', () => {
  it('returns SET statement_timeout for postgres', () => {
    expect(applyTimeout('postgres', 30000)).toBe('SET statement_timeout = 30000');
  });

  it('returns SET MAX_EXECUTION_TIME for mysql', () => {
    expect(applyTimeout('mysql', 30000)).toBe('SET SESSION MAX_EXECUTION_TIME = 30000');
  });

  it('returns ALTER SESSION for snowflake (seconds)', () => {
    expect(applyTimeout('snowflake', 30000)).toBe('ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 30');
  });

  it('returns SET max_execution_time for clickhouse (seconds)', () => {
    expect(applyTimeout('clickhouse', 30000)).toBe('SET max_execution_time = 30');
  });

  it('returns null for sqlite', () => {
    expect(applyTimeout('sqlite', 30000)).toBeNull();
  });

  it('returns null for bigquery', () => {
    expect(applyTimeout('bigquery', 30000)).toBeNull();
  });

  it('returns null for duckdb', () => {
    expect(applyTimeout('duckdb', 30000)).toBeNull();
  });
});
