export { scaffoldFromSchema, type ScaffoldInput, type ScaffoldResult } from './scaffold.js';
export {
  inferTableType,
  inferGrain,
  inferSemanticRole,
  inferAggregation,
} from './heuristics.js';
export { suggestEnrichments, type EnrichResult } from './enrich.js';
