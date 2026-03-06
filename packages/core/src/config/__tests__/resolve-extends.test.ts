import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { resolveExtends } from '../resolve-extends.js';

describe('resolveExtends', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-extends-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns config as-is when no extends', async () => {
    const config = { context_dir: 'ctx', output_dir: 'out' };
    const result = await resolveExtends(config, tmpDir);
    expect(result.context_dir).toBe('ctx');
  });

  it('returns config as-is when extends is empty array', async () => {
    const config = { context_dir: 'ctx', extends: [] };
    const result = await resolveExtends(config, tmpDir);
    expect(result.context_dir).toBe('ctx');
  });

  it('resolves local YAML file', async () => {
    const baseConfig = { context_dir: 'base-ctx', minimum_tier: 'bronze' };
    fs.writeFileSync(
      path.join(tmpDir, 'base.yaml'),
      `context_dir: base-ctx\nminimum_tier: bronze\n`,
    );

    const config = { extends: ['./base.yaml'], output_dir: 'out' };
    const result = await resolveExtends(config, tmpDir);

    expect(result.context_dir).toBe('base-ctx');
    expect(result.output_dir).toBe('out');
    expect(result.minimum_tier).toBe('bronze');
  });

  it('user config wins over extended config', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'base.yaml'),
      `context_dir: base-ctx\noutput_dir: base-out\n`,
    );

    const config = { extends: ['./base.yaml'], output_dir: 'user-out' };
    const result = await resolveExtends(config, tmpDir);

    expect(result.context_dir).toBe('base-ctx');
    expect(result.output_dir).toBe('user-out');
  });

  it('deep-merges nested config objects', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'base.yaml'),
      `lint:\n  severity_overrides:\n    rule/a: "off"\n    rule/b: "error"\n`,
    );

    const config = {
      extends: ['./base.yaml'],
      lint: { severity_overrides: { 'rule/a': 'warning' } },
    };
    const result = await resolveExtends(config, tmpDir);

    const lint = result.lint as { severity_overrides: Record<string, string> };
    expect(lint.severity_overrides['rule/a']).toBe('warning'); // user wins
    expect(lint.severity_overrides['rule/b']).toBe('error'); // inherited
  });

  it('merges multiple extends left to right', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'first.yaml'),
      `context_dir: first\noutput_dir: first-out\n`,
    );
    fs.writeFileSync(
      path.join(tmpDir, 'second.yaml'),
      `context_dir: second\n`,
    );

    const config = { extends: ['./first.yaml', './second.yaml'] };
    const result = await resolveExtends(config, tmpDir);

    expect(result.context_dir).toBe('second'); // second wins over first
    expect(result.output_dir).toBe('first-out'); // only in first
  });

  it('strips extends from the result', async () => {
    fs.writeFileSync(path.join(tmpDir, 'base.yaml'), `context_dir: base\n`);

    const config = { extends: ['./base.yaml'] };
    const result = await resolveExtends(config, tmpDir);

    expect(result).not.toHaveProperty('extends');
  });
});
