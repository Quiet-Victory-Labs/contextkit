export const MCP_VERSION = '0.1.0';

export { createContextMcpServer } from './server.js';

// Re-export resource handlers for direct testing / reuse
export { readManifest } from './resources/manifest.js';
export { readConcept, listConcepts } from './resources/concept.js';
export { readProduct, listProducts } from './resources/product.js';
export { readPolicy, listPolicies } from './resources/policy.js';
export { readGlossary } from './resources/glossary.js';

// Re-export tool handlers for direct testing / reuse
export { searchContext } from './tools/search.js';
export { explainNode } from './tools/explain.js';
export { validateContext } from './tools/validate.js';
