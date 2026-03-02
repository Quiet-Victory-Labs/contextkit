import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveConfig, loadConfig } from '../loader.js';
import { DEFAULT_CONFIG } from '../defaults.js';

describe('resolveConfig', () => {
  it('merges partial config with defaults', () => {
    const config = resolveConfig({
      project: { id: 'test', displayName: 'Test', version: '1.0.0' },
    });

    // User-supplied values are applied
    expect(config.project.id).toBe('test');
    expect(config.project.displayName).toBe('Test');
    expect(config.project.version).toBe('1.0.0');

    // Defaults are preserved for fields not overridden
    expect(config.paths?.rootDir).toBe('.');
    expect(config.paths?.contextDir).toBe('./context');
    expect(config.paths?.distDir).toBe('./dist');
    expect(config.paths?.cacheDir).toBe('./.contextkit-cache');
    expect(config.site?.enabled).toBe(true);
    expect(config.site?.title).toBe('Context Site');
    expect(config.mcp?.enabled).toBe(true);
    expect(config.mcp?.http?.port).toBe(7331);
    expect(config.lint?.defaultSeverity).toBe('warning');
    expect(config.plugins).toEqual([]);
  });

  it('preserves user overrides', () => {
    const config = resolveConfig({
      project: { id: 'custom', displayName: 'Custom', version: '2.0.0' },
      paths: { contextDir: './docs' },
      site: { enabled: false, title: 'Custom Site' },
      mcp: { enabled: false, http: { port: 9999 } },
      lint: { defaultSeverity: 'error', rules: { 'no-orphans': 'warning' } },
      plugins: ['some-plugin' as unknown],
    });

    // Overridden values
    expect(config.project.id).toBe('custom');
    expect(config.paths?.contextDir).toBe('./docs');
    expect(config.site?.enabled).toBe(false);
    expect(config.site?.title).toBe('Custom Site');
    expect(config.mcp?.enabled).toBe(false);
    expect(config.mcp?.http?.port).toBe(9999);
    expect(config.lint?.defaultSeverity).toBe('error');
    expect(config.lint?.rules?.['no-orphans']).toBe('warning');
    expect(config.plugins).toEqual(['some-plugin']);

    // Deep-merged defaults for nested fields not overridden
    expect(config.paths?.rootDir).toBe('.');
    expect(config.paths?.distDir).toBe('./dist');
    expect(config.paths?.cacheDir).toBe('./.contextkit-cache');
    expect(config.site?.basePath).toBe('/');
    expect(config.mcp?.transport).toEqual(['stdio']);
    expect(config.mcp?.http?.host).toBe('127.0.0.1');
  });
});

describe('loadConfig', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loads YAML config', async () => {
    tempDir = join(tmpdir(), `contextkit-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    const yamlContent = `
project:
  id: yaml-project
  displayName: YAML Project
  version: "3.0.0"
paths:
  contextDir: ./yaml-context
site:
  title: YAML Site
`;
    writeFileSync(join(tempDir, 'contextkit.config.yaml'), yamlContent);

    const config = await loadConfig(tempDir);

    expect(config.project.id).toBe('yaml-project');
    expect(config.project.displayName).toBe('YAML Project');
    expect(config.project.version).toBe('3.0.0');
    expect(config.paths?.contextDir).toBe('./yaml-context');
    expect(config.site?.title).toBe('YAML Site');

    // Defaults filled in
    expect(config.paths?.rootDir).toBe('.');
    expect(config.mcp?.enabled).toBe(true);
    expect(config.lint?.defaultSeverity).toBe('warning');
  });

  it('loads YML config', async () => {
    tempDir = join(tmpdir(), `contextkit-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    const ymlContent = `
project:
  id: yml-project
  displayName: YML Project
  version: "1.0.0"
`;
    writeFileSync(join(tempDir, 'contextkit.config.yml'), ymlContent);

    const config = await loadConfig(tempDir);

    expect(config.project.id).toBe('yml-project');
    expect(config.project.displayName).toBe('YML Project');
  });

  it('returns default config when no config file exists', async () => {
    tempDir = join(tmpdir(), `contextkit-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    const config = await loadConfig(tempDir);

    expect(config.project.id).toBe(DEFAULT_CONFIG.project.id);
    expect(config.project.displayName).toBe(DEFAULT_CONFIG.project.displayName);
    expect(config.project.version).toBe(DEFAULT_CONFIG.project.version);
    expect(config.paths?.rootDir).toBe(DEFAULT_CONFIG.paths?.rootDir);
    expect(config.paths?.contextDir).toBe(DEFAULT_CONFIG.paths?.contextDir);
    expect(config.site?.enabled).toBe(DEFAULT_CONFIG.site?.enabled);
    expect(config.mcp?.enabled).toBe(DEFAULT_CONFIG.mcp?.enabled);
  });

  it('prefers YAML over YML when both exist', async () => {
    tempDir = join(tmpdir(), `contextkit-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    writeFileSync(
      join(tempDir, 'contextkit.config.yaml'),
      'project:\n  id: from-yaml\n  displayName: YAML\n  version: "1.0.0"\n',
    );
    writeFileSync(
      join(tempDir, 'contextkit.config.yml'),
      'project:\n  id: from-yml\n  displayName: YML\n  version: "1.0.0"\n',
    );

    const config = await loadConfig(tempDir);
    expect(config.project.id).toBe('from-yaml');
  });
});
