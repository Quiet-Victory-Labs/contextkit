import { describe, it, expect } from 'vitest';
import { createEmptyGraph } from '../compiler/graph.js';
import { emitManifest } from '../compiler/emit.js';
import type { ContextKitConfig } from '../types/config.js';

const defaultConfig: ContextKitConfig = {
  context_dir: 'context',
  output_dir: 'dist',
};

describe('emitManifest with products', () => {
  it('emits manifest with products grouping', () => {
    const graph = createEmptyGraph();
    graph.models.set('orders', { name: 'orders', datasets: [] } as any);
    graph.models.set('campaigns', { name: 'campaigns', datasets: [] } as any);
    graph.governance.set('orders', { model: 'orders', owner: 'team-a' } as any);
    graph.productMap!.set('orders', 'sales');
    graph.productMap!.set('campaigns', 'marketing');

    const manifest = emitManifest(graph, defaultConfig);

    expect(manifest.products).toBeDefined();
    expect(manifest.products!['sales']).toBeDefined();
    expect(manifest.products!['sales']!.models['orders']).toBeDefined();
    expect(manifest.products!['sales']!.governance['orders']).toBeDefined();
    expect(manifest.products!['marketing']).toBeDefined();
    expect(manifest.products!['marketing']!.models['campaigns']).toBeDefined();

    // Flat structure still present (backward compat)
    expect(manifest.models['orders']).toBeDefined();
    expect(manifest.models['campaigns']).toBeDefined();
  });

  it('emits flat manifest for legacy single-product', () => {
    const graph = createEmptyGraph();
    graph.models.set('orders', { name: 'orders', datasets: [] } as any);

    const manifest = emitManifest(graph, defaultConfig);

    expect(manifest.products).toBeUndefined();
    expect(manifest.models['orders']).toBeDefined();
  });
});
