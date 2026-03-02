import type { ContextKitConfig } from '../types/index.js';

export const DEFAULT_CONFIG: ContextKitConfig = {
  project: { id: 'my-context', displayName: 'My Context', version: '0.1.0' },
  paths: {
    rootDir: '.',
    contextDir: './context',
    distDir: './dist',
    cacheDir: './.contextkit-cache',
  },
  site: { enabled: true, title: 'Context Site', basePath: '/' },
  lint: { defaultSeverity: 'warning', rules: {} },
  mcp: {
    enabled: true,
    transport: ['stdio'],
    http: { port: 7331, host: '127.0.0.1' },
  },
  plugins: [],
};
