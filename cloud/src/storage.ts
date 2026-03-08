/**
 * In-memory storage layer for published semantic planes.
 *
 * Stores everything in Maps — easy to swap for Postgres/R2 later.
 * Each org has a single "latest" plane (manifest + files).
 */

export interface StoredPlane {
  org: string;
  manifest: Record<string, unknown>;
  files: Array<{ path: string; content: string }>;
  publishedAt: string;
  version: number;
}

export interface Storage {
  /** Store a published plane, returning the new version number. */
  putPlane(org: string, manifest: Record<string, unknown>, files: Array<{ path: string; content: string }>): number;

  /** Get the latest plane for an org, or undefined. */
  getPlane(org: string): StoredPlane | undefined;

  /** List all product names for an org (from manifest.products keys). */
  getProducts(org: string): string[];

  /** Get a single product detail from the manifest. */
  getProduct(org: string, name: string): Record<string, unknown> | undefined;

  /** Simple text search across an org's manifest (models, terms, etc.). */
  search(org: string, query: string): Array<{ type: string; name: string; match: string }>;
}

export class InMemoryStorage implements Storage {
  private planes = new Map<string, StoredPlane>();

  putPlane(
    org: string,
    manifest: Record<string, unknown>,
    files: Array<{ path: string; content: string }>,
  ): number {
    const existing = this.planes.get(org);
    const version = existing ? existing.version + 1 : 1;

    this.planes.set(org, {
      org,
      manifest,
      files,
      publishedAt: new Date().toISOString(),
      version,
    });

    return version;
  }

  getPlane(org: string): StoredPlane | undefined {
    return this.planes.get(org);
  }

  getProducts(org: string): string[] {
    const plane = this.planes.get(org);
    if (!plane) return [];

    const products = plane.manifest['products'] as Record<string, unknown> | undefined;
    if (!products || typeof products !== 'object') return [];

    return Object.keys(products);
  }

  getProduct(org: string, name: string): Record<string, unknown> | undefined {
    const plane = this.planes.get(org);
    if (!plane) return undefined;

    const products = plane.manifest['products'] as Record<string, Record<string, unknown>> | undefined;
    if (!products || typeof products !== 'object') return undefined;

    return products[name];
  }

  search(org: string, query: string): Array<{ type: string; name: string; match: string }> {
    const plane = this.planes.get(org);
    if (!plane || !query) return [];

    const results: Array<{ type: string; name: string; match: string }> = [];
    const q = query.toLowerCase();

    // Search across top-level manifest sections: models, terms, governance, rules, lineage, owners
    const sections = ['models', 'terms', 'governance', 'rules', 'lineage', 'owners'] as const;

    for (const section of sections) {
      const entries = plane.manifest[section] as Record<string, unknown> | undefined;
      if (!entries || typeof entries !== 'object') continue;

      for (const [name, value] of Object.entries(entries)) {
        const serialized = JSON.stringify(value).toLowerCase();
        if (name.toLowerCase().includes(q) || serialized.includes(q)) {
          results.push({ type: section, name, match: name });
        }
      }
    }

    return results;
  }
}

/** Singleton storage instance. Replace with Postgres-backed impl later. */
export const storage = new InMemoryStorage();
