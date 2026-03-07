import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('studio integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-test-'));
    fs.mkdirSync(path.join(tmpDir, 'context', 'models'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'context', 'governance'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'context', 'owners'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'contextkit.config.yaml'),
      'context_dir: context\noutput_dir: dist\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'context', 'models', 'test.osi.yaml'),
      'version: "1.0"\nsemantic_model:\n  - name: test\n    description: Old description\n    datasets: []\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'context', 'governance', 'test.governance.yaml'),
      'model: test\nowner: test-owner\ndescription: Gov desc\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'context', 'owners', 'test-owner.owner.yaml'),
      'id: test-owner\ndisplay_name: Test\nemail: test@test.com\n',
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('round-trips YAML edits preserving structure', async () => {
    const { applyYamlEdit } = await import('@runcontext/core');
    const filePath = path.join(tmpDir, 'context', 'models', 'test.osi.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const updated = applyYamlEdit(content, 'semantic_model.0.description', 'New description');
    fs.writeFileSync(filePath, updated, 'utf-8');
    const verify = fs.readFileSync(filePath, 'utf-8');
    expect(verify).toContain('New description');
    expect(verify).toContain('version:');
    expect(verify).toContain('semantic_model:');
  });

  it('edits governance YAML preserving other fields', async () => {
    const { applyYamlEdit } = await import('@runcontext/core');
    const filePath = path.join(tmpDir, 'context', 'governance', 'test.governance.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const updated = applyYamlEdit(content, 'owner', 'new-owner');
    fs.writeFileSync(filePath, updated, 'utf-8');
    const verify = fs.readFileSync(filePath, 'utf-8');
    expect(verify).toContain('owner: new-owner');
    expect(verify).toContain('model: test');
    expect(verify).toContain('description: Gov desc');
  });

  it('previews without modifying the file', async () => {
    const { previewYamlEdit } = await import('@runcontext/core');
    const filePath = path.join(tmpDir, 'context', 'owners', 'test-owner.owner.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const preview = previewYamlEdit(content, 'display_name', 'Updated Name');
    expect(preview.changed).toBe(true);
    expect(preview.after).toContain('display_name: Updated Name');
    // File should be unchanged
    const verify = fs.readFileSync(filePath, 'utf-8');
    expect(verify).toContain('display_name: Test');
  });
});
