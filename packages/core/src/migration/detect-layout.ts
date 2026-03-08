import * as fs from 'node:fs';
import * as path from 'node:path';

export type LayoutMode = 'flat' | 'products';

/**
 * Detect whether a context directory uses flat or products layout.
 *
 * - 'products': `products/` directory exists with subdirectories
 * - 'flat': everything else (legacy single-product layout)
 */
export function detectLayout(contextDir: string): LayoutMode {
  const productsDir = path.join(contextDir, 'products');

  if (!fs.existsSync(productsDir) || !fs.statSync(productsDir).isDirectory()) {
    return 'flat';
  }

  // Check if products/ has any subdirectories (not just empty)
  const entries = fs.readdirSync(productsDir).filter((name) => {
    const fullPath = path.join(productsDir, name);
    return fs.statSync(fullPath).isDirectory() && !name.startsWith('.');
  });

  return entries.length > 0 ? 'products' : 'flat';
}

/**
 * List product names in a products-layout context directory.
 * Returns empty array for flat layout.
 */
export function listProductNames(contextDir: string): string[] {
  if (detectLayout(contextDir) !== 'products') return [];

  const productsDir = path.join(contextDir, 'products');
  return fs.readdirSync(productsDir).filter((name) => {
    const fullPath = path.join(productsDir, name);
    return fs.statSync(fullPath).isDirectory() && !name.startsWith('.');
  }).sort();
}
