import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolvePublishOptions,
  buildPublishUrl,
  collectYamlFiles,
  isNetworkError,
  DEFAULT_API_URL,
} from '../commands/publish.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('resolvePublishOptions', () => {
  const savedApiKey = process.env.RUNCONTEXT_API_KEY;
  const savedOrg = process.env.RUNCONTEXT_ORG;

  beforeEach(() => {
    delete process.env.RUNCONTEXT_API_KEY;
    delete process.env.RUNCONTEXT_ORG;
  });

  afterEach(() => {
    if (savedApiKey !== undefined) process.env.RUNCONTEXT_API_KEY = savedApiKey;
    else delete process.env.RUNCONTEXT_API_KEY;
    if (savedOrg !== undefined) process.env.RUNCONTEXT_ORG = savedOrg;
    else delete process.env.RUNCONTEXT_ORG;
  });

  it('throws when no API key is provided', () => {
    expect(() =>
      resolvePublishOptions({ org: 'test-org' }),
    ).toThrow('API key required');
  });

  it('throws when no org is provided', () => {
    expect(() =>
      resolvePublishOptions({ apiKey: 'test-key' }),
    ).toThrow('Organization required');
  });

  it('reads API key from RUNCONTEXT_API_KEY env var', () => {
    process.env.RUNCONTEXT_API_KEY = 'env-key';
    const result = resolvePublishOptions({ org: 'my-org' });
    expect(result.apiKey).toBe('env-key');
  });

  it('reads org from RUNCONTEXT_ORG env var', () => {
    process.env.RUNCONTEXT_ORG = 'env-org';
    const result = resolvePublishOptions({ apiKey: 'my-key' });
    expect(result.org).toBe('env-org');
  });

  it('prefers explicit options over env vars', () => {
    process.env.RUNCONTEXT_API_KEY = 'env-key';
    process.env.RUNCONTEXT_ORG = 'env-org';
    const result = resolvePublishOptions({
      apiKey: 'explicit-key',
      org: 'explicit-org',
    });
    expect(result.apiKey).toBe('explicit-key');
    expect(result.org).toBe('explicit-org');
  });

  it('uses default API URL when not specified', () => {
    const result = resolvePublishOptions({
      apiKey: 'key',
      org: 'org',
    });
    expect(result.apiUrl).toBe(DEFAULT_API_URL);
  });

  it('uses custom API URL when specified', () => {
    const result = resolvePublishOptions({
      apiKey: 'key',
      org: 'org',
      apiUrl: 'https://custom.api.dev',
    });
    expect(result.apiUrl).toBe('https://custom.api.dev');
  });
});

describe('buildPublishUrl', () => {
  it('appends /api/publish to base URL', () => {
    expect(buildPublishUrl('https://api.runcontext.dev')).toBe(
      'https://api.runcontext.dev/api/publish',
    );
  });

  it('strips trailing slashes from base URL', () => {
    expect(buildPublishUrl('https://api.runcontext.dev/')).toBe(
      'https://api.runcontext.dev/api/publish',
    );
    expect(buildPublishUrl('https://api.runcontext.dev///')).toBe(
      'https://api.runcontext.dev/api/publish',
    );
  });
});

describe('isNetworkError', () => {
  it('detects fetch failed', () => {
    expect(isNetworkError('fetch failed')).toBe(true);
  });

  it('detects ECONNREFUSED', () => {
    expect(isNetworkError('connect ECONNREFUSED 127.0.0.1:443')).toBe(true);
  });

  it('detects ENOTFOUND', () => {
    expect(isNetworkError('getaddrinfo ENOTFOUND api.runcontext.dev')).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isNetworkError('Unauthorized')).toBe(false);
    expect(isNetworkError('Publish failed (HTTP 401)')).toBe(false);
  });
});

describe('collectYamlFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array for nonexistent directory', () => {
    const result = collectYamlFiles('/nonexistent/path');
    expect(result).toEqual([]);
  });

  it('returns empty array for directory with no YAML files', () => {
    fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'hello');
    const result = collectYamlFiles(tmpDir);
    expect(result).toEqual([]);
  });

  it('collects .yaml files', () => {
    fs.writeFileSync(path.join(tmpDir, 'model.yaml'), 'name: test');
    const result = collectYamlFiles(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe('model.yaml');
    expect(result[0]!.content).toBe('name: test');
  });

  it('collects .yml files', () => {
    fs.writeFileSync(path.join(tmpDir, 'model.yml'), 'name: test');
    const result = collectYamlFiles(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe('model.yml');
  });

  it('collects files recursively with relative paths', () => {
    const subDir = path.join(tmpDir, 'sub');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(tmpDir, 'root.yaml'), 'a: 1');
    fs.writeFileSync(path.join(subDir, 'nested.yaml'), 'b: 2');

    const result = collectYamlFiles(tmpDir);
    expect(result).toHaveLength(2);

    const paths = result.map((f) => f.path).sort();
    expect(paths).toContain('root.yaml');
    expect(paths).toContain(path.join('sub', 'nested.yaml'));
  });

  it('ignores non-YAML files in mixed directories', () => {
    fs.writeFileSync(path.join(tmpDir, 'model.yaml'), 'name: test');
    fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# Docs');
    fs.writeFileSync(path.join(tmpDir, 'data.json'), '{}');

    const result = collectYamlFiles(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe('model.yaml');
  });
});
