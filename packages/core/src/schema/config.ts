import { z } from 'zod';

export const metadataTierEnum = z.enum(['none', 'bronze', 'silver', 'gold']);
export const severityEnum = z.enum(['error', 'warning']);
export const severityOrOffEnum = z.union([severityEnum, z.literal('off')]);

export const lintConfigSchema = z.object({
  severity_overrides: z.record(z.string(), severityOrOffEnum).optional(),
  ignore: z.array(z.string()).optional(),
});

export const siteConfigSchema = z.object({
  title: z.string().optional(),
  base_path: z.string().optional(),
});

export const mcpConfigSchema = z.object({
  transport: z.enum(['stdio', 'http']).optional(),
  port: z.number().optional(),
});

export const dataSourceConfigSchema = z.object({
  adapter: z.enum(['duckdb', 'postgres']),
  path: z.string().optional(),
  connection: z.string().optional(),
});

export const contextKitConfigSchema = z.object({
  context_dir: z.string().default('context'),
  output_dir: z.string().default('dist'),
  minimum_tier: metadataTierEnum.optional(),
  extends: z.array(z.string()).optional(),
  plugins: z.array(z.string()).optional(),
  lint: lintConfigSchema.optional(),
  site: siteConfigSchema.optional(),
  mcp: mcpConfigSchema.optional(),
  data_sources: z.record(z.string(), dataSourceConfigSchema).optional(),
});
