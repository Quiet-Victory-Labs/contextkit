import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compile,
  LintEngine,
  ALL_RULES,
  emitManifest,
  resolveConfig,
  discoverFiles,
  parseFile,
  validateFile,
  buildGraph,
} from '../index.js';
import type { Diagnostic, ContextNode } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../../../fixtures');

describe('Integration: error fixture produces expected diagnostics', () => {
  it('detects naming/id-kebab-case, ownership/required, and references/resolvable', async () => {
    const contextDir = path.join(FIXTURES, 'errors', 'context');

    // Use lower-level APIs to build graph WITHOUT normalization,
    // so the naming/id-kebab-case lint rule can detect the raw non-kebab ID.
    const files = await discoverFiles(contextDir);
    const compileDiagnostics: Diagnostic[] = [];
    const nodes: ContextNode[] = [];

    for (const filePath of files) {
      const parsed = await parseFile(filePath);
      const { node, diagnostics } = validateFile(parsed);
      compileDiagnostics.push(...diagnostics);
      if (node) {
        nodes.push(node); // Skip normalization intentionally
      }
    }

    const graph = buildGraph(nodes);

    // Run all lint rules
    const engine = new LintEngine();
    for (const rule of ALL_RULES) {
      engine.register(rule);
    }
    const lintDiagnostics = engine.run(graph);

    // Merge compile + lint diagnostics
    const allDiagnostics = [...compileDiagnostics, ...lintDiagnostics];

    // Assert: at least one diagnostic with ruleId naming/id-kebab-case (for BadCamelCaseId)
    const kebabDiags = allDiagnostics.filter(
      (d) => d.ruleId === 'naming/id-kebab-case',
    );
    expect(kebabDiags.length).toBeGreaterThanOrEqual(1);
    expect(kebabDiags.some((d) => d.message.includes('BadCamelCaseId'))).toBe(
      true,
    );

    // Assert: at least one diagnostic with ruleId ownership/required (for no-owner-concept)
    const ownerDiags = allDiagnostics.filter(
      (d) => d.ruleId === 'ownership/required',
    );
    expect(ownerDiags.length).toBeGreaterThanOrEqual(1);
    expect(
      ownerDiags.some((d) => d.message.includes('no-owner-concept')),
    ).toBe(true);

    // Assert: at least one diagnostic with ruleId references/resolvable (for depends_on nonexistent-concept)
    const refDiags = allDiagnostics.filter(
      (d) => d.ruleId === 'references/resolvable',
    );
    expect(refDiags.length).toBeGreaterThanOrEqual(1);
    expect(
      refDiags.some((d) => d.message.includes('nonexistent-concept')),
    ).toBe(true);

    // Assert: diagnostics reference the correct source files
    expect(
      kebabDiags.some((d) => d.source.file.includes('bad-id.ctx.yaml')),
    ).toBe(true);
    expect(
      ownerDiags.some((d) => d.source.file.includes('no-owner.ctx.yaml')),
    ).toBe(true);
    expect(
      refDiags.some((d) => d.source.file.includes('unresolvable.ctx.yaml')),
    ).toBe(true);
  });
});

describe('Integration: minimal fixture compiles cleanly', () => {
  it('produces no error-severity diagnostics and emits valid manifest', async () => {
    const contextDir = path.join(FIXTURES, 'minimal', 'context');
    const config = resolveConfig({
      project: { id: 'minimal-test', displayName: 'Minimal Test', version: '0.1.0' },
    });

    // Compile
    const { graph, diagnostics: compileDiags } = await compile({
      contextDir,
      config,
    });

    // Lint
    const engine = new LintEngine();
    for (const rule of ALL_RULES) {
      engine.register(rule);
    }
    const lintDiags = engine.run(graph);
    const allDiagnostics = [...compileDiags, ...lintDiags];

    // Verify: no error-severity diagnostics (warnings are OK)
    const errors = allDiagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);

    // Emit manifest
    const manifest = emitManifest(graph, config);

    // Verify manifest has expected node counts
    expect(manifest.concepts).toHaveLength(1);
    expect(manifest.products).toHaveLength(1);
    expect(manifest.policies).toHaveLength(1);
    expect(manifest.owners).toHaveLength(1);
  });
});

describe('Integration: full fixture produces valid manifest', () => {
  it('compiles all node types and emits correct manifest structure', async () => {
    const contextDir = path.join(FIXTURES, 'full', 'context');
    const config = resolveConfig({
      project: { id: 'full-test', displayName: 'Full Test', version: '0.1.0' },
    });

    // Compile
    const { graph, diagnostics: compileDiags } = await compile({
      contextDir,
      config,
    });

    // Lint
    const engine = new LintEngine();
    for (const rule of ALL_RULES) {
      engine.register(rule);
    }
    const lintDiags = engine.run(graph);
    const allDiagnostics = [...compileDiags, ...lintDiags];

    // No schema/invalid errors
    const schemaErrors = allDiagnostics.filter(
      (d) => d.ruleId === 'schema/invalid',
    );
    expect(schemaErrors).toEqual([]);

    // Emit manifest
    const manifest = emitManifest(graph, config);

    // Verify manifest structure has all arrays
    expect(Array.isArray(manifest.concepts)).toBe(true);
    expect(Array.isArray(manifest.products)).toBe(true);
    expect(Array.isArray(manifest.policies)).toBe(true);
    expect(Array.isArray(manifest.entities)).toBe(true);
    expect(Array.isArray(manifest.terms)).toBe(true);
    expect(Array.isArray(manifest.owners)).toBe(true);

    // Verify each array has expected count
    expect(manifest.concepts).toHaveLength(2); // revenue, cost
    expect(manifest.products).toHaveLength(1); // reporting
    expect(manifest.policies).toHaveLength(1); // data-access
    expect(manifest.entities).toHaveLength(1); // invoice
    expect(manifest.terms).toHaveLength(1); // gross-revenue
    expect(manifest.owners).toHaveLength(1); // finance-team

    // Verify indexes.byId has entries for all nodes
    const byId = manifest.indexes.byId;
    expect(byId['revenue']).toBeDefined();
    expect(byId['cost']).toBeDefined();
    expect(byId['reporting']).toBeDefined();
    expect(byId['data-access']).toBeDefined();
    expect(byId['invoice']).toBeDefined();
    expect(byId['gross-revenue']).toBeDefined();
    expect(byId['finance-team']).toBeDefined();

    // Verify index entries have correct kinds
    expect(byId['revenue'].kind).toBe('concept');
    expect(byId['cost'].kind).toBe('concept');
    expect(byId['reporting'].kind).toBe('product');
    expect(byId['data-access'].kind).toBe('policy');
    expect(byId['invoice'].kind).toBe('entity');
    expect(byId['gross-revenue'].kind).toBe('term');
    expect(byId['finance-team'].kind).toBe('owner');
  });
});

describe('Integration: end-to-end compile + lint + emit pipeline', () => {
  it('verifies manifest project and build metadata from minimal fixture', async () => {
    const contextDir = path.join(FIXTURES, 'minimal', 'context');
    const config = resolveConfig({
      project: { id: 'minimal-test', displayName: 'Minimal Test', version: '0.1.0' },
    });

    // Compile
    const { graph } = await compile({ contextDir, config });

    // Lint
    const engine = new LintEngine();
    for (const rule of ALL_RULES) {
      engine.register(rule);
    }
    engine.run(graph);

    // Emit manifest
    const manifest = emitManifest(graph, config);

    // Verify manifest.project matches config
    expect(manifest.project.id).toBe('minimal-test');
    expect(manifest.project.displayName).toBe('Minimal Test');
    expect(manifest.project.version).toBe('0.1.0');

    // Verify manifest.build has timestamp and version
    expect(manifest.build).toBeDefined();
    expect(manifest.build.timestamp).toBeDefined();
    expect(typeof manifest.build.timestamp).toBe('string');
    // Timestamp should be a valid ISO date string
    expect(new Date(manifest.build.timestamp).toISOString()).toBe(
      manifest.build.timestamp,
    );
    expect(manifest.build.version).toBeDefined();
    expect(typeof manifest.build.version).toBe('string');

    // Verify nodeCount
    expect(manifest.build.nodeCount).toBe(graph.nodes.size);

    // Verify schemaVersion
    expect(manifest.schemaVersion).toBe('1.0.0');
  });
});
