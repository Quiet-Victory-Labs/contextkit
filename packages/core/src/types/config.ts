import type { Severity } from './nodes.js';

export interface ProjectConfig {
  id: string;
  displayName: string;
  version: string;
}

export interface PathsConfig {
  rootDir?: string;
  contextDir?: string;
  distDir?: string;
  cacheDir?: string;
}

export interface SiteConfig {
  enabled?: boolean;
  title?: string;
  basePath?: string;
}

export interface McpConfig {
  enabled?: boolean;
  transport?: ('stdio' | 'http')[];
  http?: { port?: number; host?: string };
}

export interface LintConfig {
  defaultSeverity?: Severity;
  rules?: Record<string, Severity | 'off'>;
}

export interface ContextKitConfig {
  project: ProjectConfig;
  paths?: PathsConfig;
  site?: SiteConfig;
  mcp?: McpConfig;
  lint?: LintConfig;
  plugins?: unknown[];
}
