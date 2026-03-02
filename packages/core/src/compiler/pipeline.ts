import type { ContextGraph, ContextKitConfig, Diagnostic } from '../types/index.js';
import { discoverFiles } from '../parser/discover.js';
import { parseFile } from '../parser/parse.js';
import { validate } from './validate.js';
import { buildGraph } from './graph.js';
import { resolveReferences } from './resolve.js';
import { computeAllTiers } from '../tier/compute.js';

export interface CompileResult {
  graph: ContextGraph;
  diagnostics: Diagnostic[];
}

export async function compile(options: {
  contextDir: string;
  config?: Partial<ContextKitConfig>;
}): Promise<CompileResult> {
  const allDiagnostics: Diagnostic[] = [];

  // 1. Discover all files
  const discovered = await discoverFiles(options.contextDir);

  // 2. Parse each file
  const parsed = await Promise.all(
    discovered.map((f) => parseFile(f.path, f.kind)),
  );

  // 3. Validate each parsed file
  const validated = parsed.map(validate);

  // Collect validation diagnostics
  for (const result of validated) {
    allDiagnostics.push(...result.diagnostics);
  }

  // 4. Build graph from successful validations
  const graph = buildGraph(validated);

  // 5. Resolve references
  const refDiagnostics = resolveReferences(graph);
  allDiagnostics.push(...refDiagnostics);

  // 6. Compute tier scores
  computeAllTiers(graph);

  // 7. Return graph + all diagnostics
  return { graph, diagnostics: allDiagnostics };
}
