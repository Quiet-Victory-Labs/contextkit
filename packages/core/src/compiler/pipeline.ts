import type { ContextGraph, ContextKitConfig, ContextNode, Diagnostic } from '../types/index.js';
import { discoverFiles, parseFile } from '../parser/index.js';
import { validateFile } from './validate.js';
import { normalizeNode } from './normalize.js';
import { buildGraph } from '../graph/index.js';

export interface CompileOptions {
  contextDir: string;
  config: Partial<ContextKitConfig>;
}

export interface CompileResult {
  graph: ContextGraph;
  diagnostics: Diagnostic[];
}

/**
 * Run the full compiler pipeline:
 *   1. Discover context files
 *   2. Parse each YAML file
 *   3. Validate (Zod schema) -> typed ContextNode
 *   4. Normalize (kebab-case IDs, lowercase tags)
 *   5. Build graph
 */
export async function compile(options: CompileOptions): Promise<CompileResult> {
  const diagnostics: Diagnostic[] = [];
  const nodes: ContextNode[] = [];

  // 1. Discover files
  const files = await discoverFiles(options.contextDir);

  // 2-4. Parse, validate, normalize each file
  for (const filePath of files) {
    // 2. Parse
    const parsed = await parseFile(filePath);

    // 3. Validate
    const { node, diagnostics: fileDiags } = validateFile(parsed);
    diagnostics.push(...fileDiags);

    if (!node) {
      continue;
    }

    // 4. Normalize
    const normalized = normalizeNode(node);
    nodes.push(normalized);
  }

  // 5. Build graph
  const graph = buildGraph(nodes);

  return { graph, diagnostics };
}
