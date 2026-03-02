import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compile } from '../pipeline.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../../../../fixtures/minimal');

describe('compile', () => {
  it('compiles the minimal fixture into a graph', async () => {
    const result = await compile({
      contextDir: join(FIXTURES, 'context'),
      config: { project: { id: 'test', displayName: 'Test', version: '0.1.0' } },
    });

    // Should have no validation errors
    expect(result.diagnostics).toEqual([]);

    // Should have at least 3 nodes (concept, product, owner; + policy)
    expect(result.graph.nodes.size).toBeGreaterThanOrEqual(3);

    // Verify specific node IDs exist (kebab-case after normalization)
    expect(result.graph.nodes.has('gross-revenue')).toBe(true);
    expect(result.graph.nodes.has('revenue-reporting')).toBe(true);
    expect(result.graph.nodes.has('finance-team')).toBe(true);

    // The policy should also be present
    expect(result.graph.nodes.has('pii-access')).toBe(true);

    // Verify indexes were built
    const conceptIds = result.graph.indexes.byKind.get('concept');
    expect(conceptIds).toContain('gross-revenue');

    const ownerIds = result.graph.indexes.byKind.get('owner');
    expect(ownerIds).toContain('finance-team');

    // Verify edges: gross-revenue should have an owned_by edge to finance-team
    const ownedByEdges = result.graph.edges.filter(
      (e) => e.from === 'gross-revenue' && e.type === 'owned_by',
    );
    expect(ownedByEdges).toHaveLength(1);
    expect(ownedByEdges[0]!.to).toBe('finance-team');

    // Verify tags are lowercase
    const grossRevenue = result.graph.nodes.get('gross-revenue');
    expect(grossRevenue).toBeDefined();
    if (grossRevenue && grossRevenue.tags) {
      for (const tag of grossRevenue.tags) {
        expect(tag).toBe(tag.toLowerCase());
      }
    }
  });
});
