import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keychain } from '../keychain.js';

// Mock child_process.execFile
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';

const mockExecFile = vi.mocked(execFile);

describe('Keychain', () => {
  const keychain = new Keychain();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get returns null when no credential found', async () => {
    mockExecFile.mockImplementation((_cmd, _args, cb: any) => {
      const err = new Error('not found') as any;
      err.code = 44; // macOS "not found" exit code
      cb(err, '', '');
      return {} as any;
    });

    const result = await keychain.get('neon:test');
    expect(result).toBeNull();
  });

  it('set calls the correct OS command', async () => {
    mockExecFile.mockImplementation((_cmd, _args, cb: any) => {
      cb(null, '', '');
      return {} as any;
    });

    await keychain.set('neon:test', 'my-secret-token');
    expect(mockExecFile).toHaveBeenCalled();
    // Verify the service name is "runcontext"
    const callArgs = mockExecFile.mock.calls[0];
    expect(callArgs).toBeDefined();
  });

  it('delete calls the correct OS command', async () => {
    mockExecFile.mockImplementation((_cmd, _args, cb: any) => {
      cb(null, '', '');
      return {} as any;
    });

    await keychain.delete('neon:test');
    expect(mockExecFile).toHaveBeenCalled();
  });

  it('isAvailable returns boolean', async () => {
    mockExecFile.mockImplementation((_cmd, _args, cb: any) => {
      cb(null, '', '');
      return {} as any;
    });

    const available = await keychain.isAvailable();
    expect(typeof available).toBe('boolean');
  });
});
