import type { ContextGraph, ContextKitConfig, Diagnostic } from '../types/index.js';
import { discoverFiles } from '../parser/discover.js';
import { parseFile } from '../parser/parse.js';
import { validate } from './validate.js';
import { buildGraph } from './graph.js';
import { resolveReferences } from './resolve.js';
import { computeAllTiers } from '../tier/compute.js';
import { loadIgnorePatterns } from '../config/ignore.js';
import { extractDirectives, type Directive } from '../linter/directives.js';

export interface CompileResult {
  graph: ContextGraph;
  diagnostics: Diagnostic[];
  directives: Directive[];
}

export async function compile(options: {
  contextDir: string;
  config?: Partial<ContextKitConfig>;
  rootDir?: string;
}): Promise<CompileResult> {
  const allDiagnostics: Diagnostic[] = [];

  // 1. Discover all files (with ignore patterns)
  const ignorePatterns = options.rootDir
    ? loadIgnorePatterns(options.rootDir, options.config?.lint?.ignore)
    : (options.config?.lint?.ignore ?? []);
  const discovered = await discoverFiles(options.contextDir, ignorePatterns);

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

  // 7. Extract inline directives from all discovered files
  const directives: Directive[] = [];
  for (const file of discovered) {
    directives.push(...extractDirectives(file.path));
  }

  // 8. Return graph + diagnostics + directives
  return { graph, diagnostics: allDiagnostics, directives };
}
