// RunContext Site Generator v0.3 (Astro + EJS legacy)
export { generateSite, buildSite, buildAstroSite, getAstroProjectDir } from './generator.js';
export type { GenerateSiteOptions } from './generator.js';
export { buildSearchIndex } from './search/build-index.js';
export type { SearchDocument, SearchIndex } from './search/build-index.js';
export {
  indexTemplate,
  modelTemplate,
  schemaTemplate,
  rulesTemplate,
  glossaryTemplate,
  ownerTemplate,
  searchTemplate,
} from './templates.js';
