export { scaffoldFromSchema, type ScaffoldInput, type ScaffoldResult } from './scaffold.js';
export {
  inferTableType,
  inferGrain,
  inferSemanticRole,
  inferAggregation,
  inferRelationships,
  inferGuardrails,
} from './heuristics.js';
export { suggestEnrichments, type EnrichResult } from './enrich.js';
