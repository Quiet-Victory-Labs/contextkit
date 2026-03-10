import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CredentialStore } from '../credential-store.js';

vi.mock('node:fs');
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock-home'),
}));

// Mock the Keychain class
vi.mock('../keychain.js', () => ({
  Keychain: vi.fn().mockImplementation(() => ({
    isAvailable: vi.fn().mockResolvedValue(false), // Force file fallback in tests
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  })),
}));

const mockFs = vi.mocked(fs);

describe('CredentialStore', () => {
  let store: CredentialStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new CredentialStore();
  });

  it('save writes to credentials file when keychain unavailable', async () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => undefined as any);

    await store.save({
      provider: 'neon',
      key: 'neon:test-db',
      token: 'secret',
    });

    expect(mockFs.writeFileSync).toHaveBeenCalled();
    const writeCall = mockFs.writeFileSync.mock.calls[0];
    expect(String(writeCall[0])).toContain('credentials.json');
    const written = JSON.parse(String(writeCall[1]));
    expect(written.databases['neon:test-db'].token).toBe('secret');
  });

  it('load reads from credentials file when keychain unavailable', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      databases: {
        'neon:test-db': { provider: 'neon', key: 'neon:test-db', token: 'found' },
      },
    }));

    const cred = await store.load('neon:test-db');
    expect(cred).not.toBeNull();
    expect(cred!.token).toBe('found');
  });

  it('load returns null for unknown key', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ databases: {} }));

    const cred = await store.load('neon:nonexistent');
    expect(cred).toBeNull();
  });

  it('delete removes from credentials file', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      databases: { 'neon:test-db': { token: 'x' } },
    }));
    mockFs.writeFileSync.mockImplementation(() => {});

    await store.remove('neon:test-db');

    const writeCall = mockFs.writeFileSync.mock.calls[0];
    const written = JSON.parse(String(writeCall[1]));
    expect(written.databases['neon:test-db']).toBeUndefined();
  });

  it('list returns all stored credential keys', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      databases: {
        'neon:db1': { provider: 'neon' },
        'aws-rds:db2': { provider: 'aws-rds' },
      },
    }));

    const keys = await store.list();
    expect(keys).toContain('neon:db1');
    expect(keys).toContain('aws-rds:db2');
  });
});
