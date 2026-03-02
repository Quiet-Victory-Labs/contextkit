import type { MetadataTier } from './tier.js';
import type { Severity } from './diagnostics.js';

export interface LintConfig {
  severity_overrides?: Record<string, Severity | 'off'>;
}

export interface SiteConfig {
  title?: string;
  base_path?: string;
}

export interface McpConfig {
  transport?: 'stdio' | 'http';
  port?: number;
}

export interface ContextKitConfig {
  context_dir: string;
  output_dir: string;
  minimum_tier?: MetadataTier;
  lint?: LintConfig;
  site?: SiteConfig;
  mcp?: McpConfig;
}
