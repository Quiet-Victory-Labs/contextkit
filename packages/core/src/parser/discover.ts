import { glob } from 'glob';
import path from 'node:path';
import * as fs from 'node:fs';

export type FileKind = 'model' | 'governance' | 'rules' | 'lineage' | 'term' | 'owner';

export interface DiscoveredFile {
  path: string;
  kind: FileKind;
  product?: string;
}

const PATTERNS: Record<FileKind, string> = {
  model: '**/*.osi.yaml',
  governance: '**/*.governance.yaml',
  rules: '**/*.rules.yaml',
  lineage: '**/*.lineage.yaml',
  term: '**/*.term.yaml',
  owner: '**/*.owner.yaml',
};

export async function discoverFiles(
  contextDir: string,
  ignore?: string[],
): Promise<DiscoveredFile[]> {
  const files: DiscoveredFile[] = [];
  for (const [kind, pattern] of Object.entries(PATTERNS)) {
    const matches = await glob(pattern, {
      cwd: contextDir,
      absolute: true,
      ignore: ignore ?? [],
    });
    for (const match of matches) {
      files.push({ path: match, kind: kind as FileKind });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

// Product-specific file kinds (not terms or owners)
const PRODUCT_KINDS: FileKind[] = ['model', 'governance', 'rules', 'lineage'];
// Shared file kinds (at root level)
const SHARED_KINDS: FileKind[] = ['term', 'owner'];

export async function discoverFilesMultiProduct(
  contextDir: string,
  ignore?: string[],
  config?: { glossary_dir?: string; owners_dir?: string },
): Promise<DiscoveredFile[]> {
  const productsDir = path.join(contextDir, 'products');

  // If no products/ directory, fall back to flat discovery
  if (!fs.existsSync(productsDir) || !fs.statSync(productsDir).isDirectory()) {
    return discoverFiles(contextDir, ignore);
  }

  const files: DiscoveredFile[] = [];

  // Scan each product subdirectory
  const productDirs = fs.readdirSync(productsDir).filter((name) => {
    const fullPath = path.join(productsDir, name);
    return fs.statSync(fullPath).isDirectory() && !name.startsWith('.');
  });

  for (const productName of productDirs) {
    const productDir = path.join(productsDir, productName);
    for (const kind of PRODUCT_KINDS) {
      const pattern = PATTERNS[kind];
      const matches = await glob(pattern, {
        cwd: productDir,
        absolute: true,
        ignore: ignore ?? [],
      });
      for (const match of matches) {
        files.push({ path: match, kind, product: productName });
      }
    }
  }

  // If no product-scoped model files found, fall back to flat discovery.
  // This handles the case where products/ exists but only has non-model files
  // (e.g., context-brief.yaml from the setup wizard).
  const hasProductModels = files.some((f) => f.kind === 'model');
  if (!hasProductModels) {
    return discoverFiles(contextDir, ignore);
  }

  // Scan shared directories for terms and owners
  const glossaryDir = config?.glossary_dir
    ? path.join(contextDir, config.glossary_dir)
    : path.join(contextDir, 'glossary');
  const ownersDir = config?.owners_dir
    ? path.join(contextDir, config.owners_dir)
    : path.join(contextDir, 'owners');

  // Terms from glossary dir
  if (fs.existsSync(glossaryDir)) {
    const termMatches = await glob(PATTERNS.term, {
      cwd: glossaryDir,
      absolute: true,
      ignore: ignore ?? [],
    });
    for (const match of termMatches) {
      files.push({ path: match, kind: 'term' });
    }
  }

  // Owners from owners dir
  if (fs.existsSync(ownersDir)) {
    const ownerMatches = await glob(PATTERNS.owner, {
      cwd: ownersDir,
      absolute: true,
      ignore: ignore ?? [],
    });
    for (const match of ownerMatches) {
      files.push({ path: match, kind: 'owner' });
    }
  }

  // Also scan contextDir root for any terms/owners (backward compat)
  for (const kind of SHARED_KINDS) {
    const matches = await glob(PATTERNS[kind], {
      cwd: contextDir,
      absolute: true,
      ignore: [...(ignore ?? []), 'products/**'],
    });
    for (const match of matches) {
      // Avoid duplicates from glossary/owners dirs
      if (!files.some((f) => f.path === match)) {
        files.push({ path: match, kind });
      }
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
