import { describe, it, expect } from 'vitest';
import { enforceReadOnly, applyRowLimit, applyTimeout, validateReadOnlySQL } from '../guardrails.js';

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

describe('validateReadOnlySQL', () => {
  it('allows simple SELECT', () => {
    expect(validateReadOnlySQL('SELECT * FROM users')).toEqual({ valid: true });
  });

  it('allows SELECT with trailing semicolon', () => {
    expect(validateReadOnlySQL('SELECT 1;')).toEqual({ valid: true });
  });

  it('allows WITH (CTE) + SELECT', () => {
    expect(validateReadOnlySQL('WITH cte AS (SELECT id FROM users) SELECT * FROM cte')).toEqual({ valid: true });
  });

  it('allows EXPLAIN SELECT', () => {
    expect(validateReadOnlySQL('EXPLAIN SELECT * FROM users')).toEqual({ valid: true });
  });

  it('allows SHOW', () => {
    expect(validateReadOnlySQL('SHOW TABLES')).toEqual({ valid: true });
  });

  it('allows DESCRIBE', () => {
    expect(validateReadOnlySQL('DESCRIBE users')).toEqual({ valid: true });
  });

  it('rejects empty query', () => {
    const result = validateReadOnlySQL('');
    expect(result.valid).toBe(false);
  });

  it('rejects INSERT', () => {
    const result = validateReadOnlySQL("INSERT INTO users (name) VALUES ('test')");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('INSERT');
  });

  it('rejects UPDATE', () => {
    expect(validateReadOnlySQL("UPDATE users SET name = 'test'").valid).toBe(false);
  });

  it('rejects DELETE', () => {
    expect(validateReadOnlySQL('DELETE FROM users WHERE id = 1').valid).toBe(false);
  });

  it('rejects DROP', () => {
    expect(validateReadOnlySQL('DROP TABLE users').valid).toBe(false);
  });

  it('rejects CREATE', () => {
    expect(validateReadOnlySQL('CREATE TABLE test (id INT)').valid).toBe(false);
  });

  it('rejects ALTER', () => {
    expect(validateReadOnlySQL('ALTER TABLE users ADD COLUMN age INT').valid).toBe(false);
  });

  it('rejects TRUNCATE', () => {
    expect(validateReadOnlySQL('TRUNCATE TABLE users').valid).toBe(false);
  });

  it('rejects GRANT', () => {
    expect(validateReadOnlySQL('GRANT ALL ON users TO public').valid).toBe(false);
  });

  it('rejects multi-statement with semicolon injection', () => {
    expect(validateReadOnlySQL('SELECT 1; DROP TABLE users').valid).toBe(false);
  });

  it('rejects SET', () => {
    expect(validateReadOnlySQL('SET search_path TO public').valid).toBe(false);
  });

  it('rejects BEGIN', () => {
    expect(validateReadOnlySQL('BEGIN').valid).toBe(false);
  });
});
