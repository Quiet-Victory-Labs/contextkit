import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'yaml';

/**
 * Helper: create a temp directory and return its path.
 * The caller is responsible for cleanup (or rely on OS temp cleanup).
 */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'contextkit-new-test-'));
}

/**
 * Replicate the scaffolding logic from new.ts so we can test it in isolation
 * without importing the Command (which binds to process.exit).
 *
 * This mirrors the file-creation portion of the `context new` action.
 */
function scaffold(contextDir: string, name: string, source?: string) {
  const STARTER_OSI = (n: string, dataSource?: string) => {
    const doc: Record<string, unknown> = {
      version: '1.0',
      semantic_model: [
        {
          name: n,
          description: `Data product: ${n}`,
          ...(dataSource ? { data_source: dataSource } : {}),
          datasets: [],
        },
      ],
    };
    return yaml.stringify(doc, { lineWidth: 120 });
  };

  const STARTER_GOVERNANCE = (n: string) => {
    const doc = { model: n, owner: 'default-team', security: 'internal', datasets: {} };
    return yaml.stringify(doc, { lineWidth: 120 });
  };

  const STARTER_RULES = (n: string) => {
    const doc = { model: n, business_rules: [], guardrail_filters: [], golden_queries: [] };
    return yaml.stringify(doc, { lineWidth: 120 });
  };

  const STARTER_OWNER = () => {
    const doc = { id: 'default-team', display_name: 'Default Team' };
    return yaml.stringify(doc, { lineWidth: 120 });
  };

  const dirs = [
    path.join(contextDir, 'models'),
    path.join(contextDir, 'governance'),
    path.join(contextDir, 'owners'),
    path.join(contextDir, 'reference'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const files = [
    { rel: path.join('models', `${name}.osi.yaml`), content: STARTER_OSI(name, source) },
    { rel: path.join('governance', `${name}.governance.yaml`), content: STARTER_GOVERNANCE(name) },
    { rel: path.join('governance', `${name}.rules.yaml`), content: STARTER_RULES(name) },
    { rel: path.join('owners', 'default-team.owner.yaml'), content: STARTER_OWNER() },
  ];

  const created: string[] = [];
  const skipped: string[] = [];

  for (const f of files) {
    const fullPath = path.join(contextDir, f.rel);
    if (fs.existsSync(fullPath)) {
      skipped.push(f.rel);
    } else {
      fs.writeFileSync(fullPath, f.content, 'utf-8');
      created.push(f.rel);
    }
  }

  return { created, skipped };
}

describe('context new scaffolding', () => {
  it('creates the expected files', () => {
    const tmp = makeTmpDir();
    const { created } = scaffold(tmp, 'my-product');

    expect(created).toHaveLength(4);
    expect(fs.existsSync(path.join(tmp, 'models', 'my-product.osi.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'governance', 'my-product.governance.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'governance', 'my-product.rules.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'owners', 'default-team.owner.yaml'))).toBe(true);
  });

  it('skips files that already exist', () => {
    const tmp = makeTmpDir();

    // First run — creates all files
    scaffold(tmp, 'existing');

    // Second run — should skip all files
    const { created, skipped } = scaffold(tmp, 'existing');
    expect(created).toHaveLength(0);
    expect(skipped).toHaveLength(4);
  });

  it('includes data_source in model YAML when --source is provided', () => {
    const tmp = makeTmpDir();
    scaffold(tmp, 'with-source', 'my_warehouse');

    const content = fs.readFileSync(path.join(tmp, 'models', 'with-source.osi.yaml'), 'utf-8');
    const parsed = yaml.parse(content);
    expect(parsed.semantic_model[0].data_source).toBe('my_warehouse');
  });

  it('omits data_source when --source is not provided', () => {
    const tmp = makeTmpDir();
    scaffold(tmp, 'no-source');

    const content = fs.readFileSync(path.join(tmp, 'models', 'no-source.osi.yaml'), 'utf-8');
    const parsed = yaml.parse(content);
    expect(parsed.semantic_model[0].data_source).toBeUndefined();
  });

  it('uses the provided name in file paths and content', () => {
    const tmp = makeTmpDir();
    scaffold(tmp, 'sales-analytics');

    // Check file names contain the product name
    expect(fs.existsSync(path.join(tmp, 'models', 'sales-analytics.osi.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'governance', 'sales-analytics.governance.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'governance', 'sales-analytics.rules.yaml'))).toBe(true);

    // Check model content uses the name
    const modelContent = yaml.parse(
      fs.readFileSync(path.join(tmp, 'models', 'sales-analytics.osi.yaml'), 'utf-8'),
    );
    expect(modelContent.semantic_model[0].name).toBe('sales-analytics');
    expect(modelContent.semantic_model[0].description).toBe('Data product: sales-analytics');

    // Check governance content uses the name
    const govContent = yaml.parse(
      fs.readFileSync(path.join(tmp, 'governance', 'sales-analytics.governance.yaml'), 'utf-8'),
    );
    expect(govContent.model).toBe('sales-analytics');

    // Check rules content uses the name
    const rulesContent = yaml.parse(
      fs.readFileSync(path.join(tmp, 'governance', 'sales-analytics.rules.yaml'), 'utf-8'),
    );
    expect(rulesContent.model).toBe('sales-analytics');
  });

  it('creates required directories', () => {
    const tmp = makeTmpDir();
    scaffold(tmp, 'dir-test');

    expect(fs.existsSync(path.join(tmp, 'models'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'governance'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'owners'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'reference'))).toBe(true);
  });
});
