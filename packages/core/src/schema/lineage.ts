import { z } from 'zod';

export const lineageTypeEnum = z.enum(['pipeline', 'dashboard', 'ml_model', 'api', 'manual', 'file', 'derived']);

export const upstreamEntrySchema = z.object({
  source: z.string(),
  type: lineageTypeEnum,
  pipeline: z.string().optional(),
  tool: z.string().optional(),
  refresh: z.string().optional(),
  notes: z.string().optional(),
});

export const downstreamEntrySchema = z.object({
  target: z.string(),
  type: lineageTypeEnum,
  tool: z.string().optional(),
  notes: z.string().optional(),
});

export const lineageFileSchema = z.object({
  model: z.string(),
  upstream: z.array(upstreamEntrySchema).optional(),
  downstream: z.array(downstreamEntrySchema).optional(),
});
