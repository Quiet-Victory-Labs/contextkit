import { z } from 'zod';

export const PRODUCT_NAME_RE = /^[a-zA-Z0-9_-]+$/;

export const SensitivityLevel = z.enum(['public', 'internal', 'confidential', 'restricted']);
export type SensitivityLevel = z.infer<typeof SensitivityLevel>;

export const ContextBriefSchema = z.object({
  product_name: z.string().min(1).regex(PRODUCT_NAME_RE),
  description: z.string().min(1),
  owner: z.object({
    name: z.string().min(1),
    team: z.string().min(1),
    email: z.string().email(),
  }),
  sensitivity: SensitivityLevel,
  data_source: z.string().optional(),
  docs: z.array(z.string()).default([]),
  created_at: z.string().datetime().optional(),
});

export type ContextBrief = z.infer<typeof ContextBriefSchema>;

export function validateBrief(data: unknown): { ok: true } | { ok: false; errors: string[] } {
  const result = ContextBriefSchema.safeParse(data);
  if (result.success) return { ok: true };
  return { ok: false, errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
