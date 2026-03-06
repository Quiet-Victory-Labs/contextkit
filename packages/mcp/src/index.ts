// ContextKit MCP Server v0.3
export { createServer, startServer, startServerHttp } from './server.js';

// Re-export resource helpers for advanced usage
export { registerManifestResource } from './resources/manifest.js';
export { registerModelResource, buildModelView } from './resources/model.js';
export { registerGlossaryResource } from './resources/glossary.js';
export { registerTierResource } from './resources/tier.js';

// Re-export tool logic functions for direct use
export { searchManifest } from './tools/search.js';
export type { SearchResult } from './tools/search.js';
export { explainModel } from './tools/explain.js';
export type { ExplainResult } from './tools/explain.js';
export { validateGraph } from './tools/validate.js';
export type { ValidateResult } from './tools/validate.js';
export { computeModelTier } from './tools/tier.js';
export { findGoldenQueries } from './tools/golden-query.js';
export type { GoldenQueryMatch } from './tools/golden-query.js';
export { findGuardrails } from './tools/guardrails.js';
export type { GuardrailMatch } from './tools/guardrails.js';
