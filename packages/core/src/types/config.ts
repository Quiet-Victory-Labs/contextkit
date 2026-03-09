import type { MetadataTier } from './tier.js';
import type { Severity } from './diagnostics.js';
import type { DataSourceConfig } from '../adapters/types.js';

export interface LintConfig {
  severity_overrides?: Record<string, Severity | 'off'>;
  ignore?: string[];
}

export interface SiteConfig {
  title?: string;
  base_path?: string;
}

export interface McpConfig {
  transport?: 'stdio' | 'http';
  port?: number;
}

/** @deprecated Use RunContextConfig instead */
export type ContextKitConfig = RunContextConfig;

export interface RunContextConfig {
  context_dir: string;
  output_dir: string;
  minimum_tier?: MetadataTier;
  extends?: string[];
  plugins?: string[];
  lint?: LintConfig;
  site?: SiteConfig;
  mcp?: McpConfig;
  data_sources?: Record<string, DataSourceConfig>;
  products?: string[];
  glossary_dir?: string;
  owners_dir?: string;
}
