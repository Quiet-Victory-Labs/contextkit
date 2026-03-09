import { describe, it, expect } from 'vitest';
import { detectAdapter } from '../server.js';

describe('detectAdapter', () => {
  it('detects postgres from postgres:// URL', () => {
    expect(detectAdapter('postgres://user:pass@localhost:5432/mydb')).toBe('postgres');
  });

  it('detects postgres from postgresql:// URL', () => {
    expect(detectAdapter('postgresql://user:pass@localhost:5432/mydb')).toBe('postgres');
  });

  it('detects mysql from mysql:// URL', () => {
    expect(detectAdapter('mysql://user:pass@localhost:3306/mydb')).toBe('mysql');
  });

  it('detects mssql from mssql:// URL', () => {
    expect(detectAdapter('mssql://user:pass@localhost:1433/mydb')).toBe('mssql');
  });

  it('detects mssql from sqlserver:// URL', () => {
    expect(detectAdapter('sqlserver://user:pass@localhost:1433/mydb')).toBe('mssql');
  });

  it('detects clickhouse from clickhouse:// URL', () => {
    expect(detectAdapter('clickhouse://localhost:8123')).toBe('clickhouse');
  });

  it('detects duckdb from .duckdb extension', () => {
    expect(detectAdapter('/path/to/database.duckdb')).toBe('duckdb');
  });

  it('detects duckdb from .db extension', () => {
    expect(detectAdapter('/path/to/database.db')).toBe('duckdb');
  });

  it('detects sqlite from .sqlite extension', () => {
    expect(detectAdapter('/path/to/database.sqlite')).toBe('sqlite');
  });

  it('detects sqlite from .sqlite3 extension', () => {
    expect(detectAdapter('/path/to/database.sqlite3')).toBe('sqlite');
  });

  it('throws for unrecognizable URLs', () => {
    expect(() => detectAdapter('unknown://something')).toThrow('Cannot detect adapter');
  });
});
