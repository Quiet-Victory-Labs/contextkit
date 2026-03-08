import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { discoverFilesMultiProduct } from '../parser/discover.js';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ck-multi-'));
}

function writeYaml(dir: string, relativePath: string, content: string) {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

describe('multi-product file discovery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers files in products/ subdirectories', async () => {
    writeYaml(tmpDir, 'products/sales/models/orders.osi.yaml', 'model: orders');
    writeYaml(tmpDir, 'products/sales/governance/orders.governance.yaml', 'governance: orders');
    writeYaml(tmpDir, 'products/marketing/models/campaigns.osi.yaml', 'model: campaigns');
    writeYaml(tmpDir, 'glossary/revenue.term.yaml', 'term: revenue');
    writeYaml(tmpDir, 'owners/analytics.owner.yaml', 'owner: analytics');

    const files = await discoverFilesMultiProduct(tmpDir);

    const models = files.filter((f) => f.kind === 'model');
    expect(models).toHaveLength(2);
    expect(models.find((f) => f.product === 'sales')).toBeDefined();
    expect(models.find((f) => f.product === 'marketing')).toBeDefined();

    const terms = files.filter((f) => f.kind === 'term');
    expect(terms).toHaveLength(1);
    expect(terms[0]?.product).toBeUndefined();

    const owners = files.filter((f) => f.kind === 'owner');
    expect(owners).toHaveLength(1);
  });

  it('falls back to flat discovery when no products/ dir', async () => {
    writeYaml(tmpDir, 'models/orders.osi.yaml', 'model: orders');
    writeYaml(tmpDir, 'glossary/revenue.term.yaml', 'term: revenue');

    const files = await discoverFilesMultiProduct(tmpDir);

    expect(files.filter((f) => f.kind === 'model')).toHaveLength(1);
    expect(files.filter((f) => f.kind === 'term')).toHaveLength(1);
    // No product tags in flat mode
    expect(files.every((f) => f.product === undefined)).toBe(true);
  });

  it('uses custom glossary_dir and owners_dir', async () => {
    writeYaml(tmpDir, 'products/sales/models/orders.osi.yaml', 'model: orders');
    writeYaml(tmpDir, 'shared-glossary/revenue.term.yaml', 'term: revenue');
    writeYaml(tmpDir, 'shared-owners/analytics.owner.yaml', 'owner: analytics');

    const files = await discoverFilesMultiProduct(tmpDir, undefined, {
      glossary_dir: 'shared-glossary',
      owners_dir: 'shared-owners',
    });

    expect(files.filter((f) => f.kind === 'term')).toHaveLength(1);
    expect(files.filter((f) => f.kind === 'owner')).toHaveLength(1);
  });
});
