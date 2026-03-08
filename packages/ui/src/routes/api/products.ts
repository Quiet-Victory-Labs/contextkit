import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'yaml';

export interface ExistingProduct {
  name: string;
  description?: string;
  sensitivity?: string;
  hasBrief: boolean;
}

export function productsRoutes(contextDir: string): Hono {
  const app = new Hono();

  app.get('/api/products', (c) => {
    const productsDir = path.join(contextDir, 'products');
    if (!fs.existsSync(productsDir)) {
      return c.json([]);
    }

    const products: ExistingProduct[] = [];
    const dirs = fs.readdirSync(productsDir).filter((name) => {
      const fullPath = path.join(productsDir, name);
      return fs.statSync(fullPath).isDirectory() && !name.startsWith('.');
    });

    for (const name of dirs) {
      const briefPath = path.join(productsDir, name, 'context-brief.yaml');
      let description: string | undefined;
      let sensitivity: string | undefined;
      let hasBrief = false;

      if (fs.existsSync(briefPath)) {
        hasBrief = true;
        try {
          const brief = parse(fs.readFileSync(briefPath, 'utf-8'));
          description = brief?.description;
          sensitivity = brief?.sensitivity;
        } catch {
          // ignore parse errors
        }
      }

      products.push({ name, description, sensitivity, hasBrief });
    }

    return c.json(products);
  });

  return app;
}
