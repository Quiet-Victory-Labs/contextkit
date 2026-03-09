import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '../loader.js';
import { DEFAULT_CONFIG } from '../defaults.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('loadConfig', () => {
  const tmpDir = path.join(import.meta.dirname ?? '.', '__tmp_config_test__');

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default config when no config file exists', () => {
    const config = loadConfig(tmpDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('falls back to legacy contextkit.config.yaml', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'contextkit.config.yaml'),
      'context_dir: legacy/context\noutput_dir: legacy-build\n',
    );

    const config = loadConfig(tmpDir);
    expect(config.context_dir).toBe('legacy/context');
    expect(config.output_dir).toBe('legacy-build');
  });

  it('prefers runcontext.config.yaml over contextkit.config.yaml', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'contextkit.config.yaml'),
      'context_dir: old\noutput_dir: old-build\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'runcontext.config.yaml'),
      'context_dir: new\noutput_dir: new-build\n',
    );

    const config = loadConfig(tmpDir);
    expect(config.context_dir).toBe('new');
    expect(config.output_dir).toBe('new-build');
  });

  it('reads runcontext.config.yaml from rootDir', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'runcontext.config.yaml'),
      'context_dir: src/context\noutput_dir: build\n',
    );

    const config = loadConfig(tmpDir);
    expect(config.context_dir).toBe('src/context');
    expect(config.output_dir).toBe('build');
  });

  it('merges file values with defaults (partial config)', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'runcontext.config.yaml'),
      'output_dir: out\n',
    );

    const config = loadConfig(tmpDir);
    expect(config.output_dir).toBe('out');
    // context_dir should fall back to default
    expect(config.context_dir).toBe('context');
  });

  it('parses optional fields like minimum_tier', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'runcontext.config.yaml'),
      'context_dir: ctx\noutput_dir: dist\nminimum_tier: silver\n',
    );

    const config = loadConfig(tmpDir);
    expect(config.minimum_tier).toBe('silver');
  });

  it('parses nested config sections (lint, site, mcp)', () => {
    const yaml = [
      'context_dir: ctx',
      'output_dir: dist',
      'lint:',
      '  severity_overrides:',
      '    rule1: error',
      '    rule2: off',
      'site:',
      '  title: My Site',
      '  base_path: /docs',
      'mcp:',
      '  transport: http',
      '  port: 3000',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, 'runcontext.config.yaml'), yaml);

    const config = loadConfig(tmpDir);
    expect(config.lint?.severity_overrides?.['rule1']).toBe('error');
    expect(config.lint?.severity_overrides?.['rule2']).toBe('off');
    expect(config.site?.title).toBe('My Site');
    expect(config.site?.base_path).toBe('/docs');
    expect(config.mcp?.transport).toBe('http');
    expect(config.mcp?.port).toBe(3000);
  });

  it('validates config via Zod schema and throws on invalid data', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'runcontext.config.yaml'),
      'minimum_tier: platinum\n',
    );

    expect(() => loadConfig(tmpDir)).toThrow();
  });

  it('handles an empty config file (returns defaults)', () => {
    fs.writeFileSync(path.join(tmpDir, 'runcontext.config.yaml'), '');

    const config = loadConfig(tmpDir);
    expect(config.context_dir).toBe('context');
    expect(config.output_dir).toBe('dist');
  });
});

describe('DEFAULT_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.context_dir).toBe('context');
    expect(DEFAULT_CONFIG.output_dir).toBe('dist');
  });

  it('has no optional fields set', () => {
    expect(DEFAULT_CONFIG.minimum_tier).toBeUndefined();
    expect(DEFAULT_CONFIG.lint).toBeUndefined();
    expect(DEFAULT_CONFIG.site).toBeUndefined();
    expect(DEFAULT_CONFIG.mcp).toBeUndefined();
  });
});
