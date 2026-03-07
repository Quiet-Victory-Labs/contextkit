import { describe, it, expect } from 'vitest';
import { applyYamlEdit, previewYamlEdit } from '../yaml-edit.js';

describe('applyYamlEdit', () => {
  it('sets a scalar value at a dot-path', () => {
    const input = `name: orders\ndescription: Old description\n`;
    const result = applyYamlEdit(input, 'description', 'New description');
    expect(result).toContain('description: New description');
    expect(result).toContain('name: orders');
  });

  it('sets a nested value at a dot-path', () => {
    const input = `governance:\n  trust: draft\n  tags:\n    - analytics\n`;
    const result = applyYamlEdit(input, 'governance.trust', 'endorsed');
    expect(result).toContain('trust: endorsed');
    expect(result).toContain('tags:');
  });

  it('sets a value in an array by index', () => {
    const input = `datasets:\n  - name: orders\n    description: Old\n  - name: users\n    description: Also old\n`;
    const result = applyYamlEdit(input, 'datasets.0.description', 'New');
    expect(result).toContain('description: New');
    expect(result).toContain('name: users');
  });

  it('preserves YAML comments', () => {
    const input = `# Important comment\nname: orders\ndescription: Old\n`;
    const result = applyYamlEdit(input, 'description', 'New');
    expect(result).toContain('# Important comment');
  });

  it('adds a new key if path does not exist', () => {
    const input = `name: orders\n`;
    const result = applyYamlEdit(input, 'description', 'Brand new');
    expect(result).toContain('description: Brand new');
  });

  it('appends to an existing array with + path', () => {
    const input = `items:\n  - name: first\n`;
    const result = applyYamlEdit(input, 'items.+', { name: 'second' });
    expect(result).toContain('name: first');
    expect(result).toContain('name: second');
  });

  it('creates a new array when appending with + to non-existent path', () => {
    const input = `name: orders\n`;
    const result = applyYamlEdit(input, 'tags.+', 'analytics');
    expect(result).toContain('tags:');
    expect(result).toContain('analytics');
  });
});

describe('previewYamlEdit', () => {
  it('returns before and after without modifying input', () => {
    const input = `name: orders\ndescription: Old\n`;
    const preview = previewYamlEdit(input, 'description', 'New');
    expect(preview.before).toBe(input);
    expect(preview.after).toContain('description: New');
    expect(preview.changed).toBe(true);
  });
});
