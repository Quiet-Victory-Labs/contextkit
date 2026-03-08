import { Hono } from 'hono';
import { storage } from '../storage.js';

const api = new Hono();

/**
 * GET /api/orgs/:org/manifest — return the latest manifest for an org.
 */
api.get('/api/orgs/:org/manifest', (c) => {
  const org = c.req.param('org');
  const plane = storage.getPlane(org);

  if (!plane) {
    return c.json({ error: `No published plane found for org: ${org}` }, 404);
  }

  return c.json({
    org,
    version: plane.version,
    publishedAt: plane.publishedAt,
    manifest: plane.manifest,
  });
});

/**
 * GET /api/orgs/:org/products — list product names for an org.
 */
api.get('/api/orgs/:org/products', (c) => {
  const org = c.req.param('org');
  const plane = storage.getPlane(org);

  if (!plane) {
    return c.json({ error: `No published plane found for org: ${org}` }, 404);
  }

  const products = storage.getProducts(org);

  return c.json({ org, products });
});

/**
 * GET /api/orgs/:org/products/:name — get a single product's detail.
 */
api.get('/api/orgs/:org/products/:name', (c) => {
  const org = c.req.param('org');
  const name = c.req.param('name');
  const plane = storage.getPlane(org);

  if (!plane) {
    return c.json({ error: `No published plane found for org: ${org}` }, 404);
  }

  const product = storage.getProduct(org, name);
  if (!product) {
    return c.json({ error: `Product not found: ${name}` }, 404);
  }

  return c.json({ org, name, product });
});

/**
 * GET /api/orgs/:org/search?q= — search across an org's semantic plane.
 */
api.get('/api/orgs/:org/search', (c) => {
  const org = c.req.param('org');
  const q = c.req.query('q') ?? '';

  const plane = storage.getPlane(org);
  if (!plane) {
    return c.json({ error: `No published plane found for org: ${org}` }, 404);
  }

  if (!q) {
    return c.json({ org, query: q, results: [] });
  }

  const results = storage.search(org, q);

  return c.json({ org, query: q, results });
});

export { api };
