import { z } from 'zod';

export const policyWhenSchema = z.object({
  tags_any: z.array(z.string()).optional(),
  concept_ids: z.array(z.string()).optional(),
  status: z.enum(['draft', 'certified', 'deprecated']).optional(),
}).passthrough();

export const policyThenSchema = z.object({
  require_role: z.string().optional(),
  deny: z.boolean().optional(),
  warn: z.string().optional(),
}).passthrough();

export const policyRuleSchema = z.object({
  priority: z.number(),
  when: policyWhenSchema,
  then: policyThenSchema,
});

export const policyFileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'certified', 'deprecated']).optional(),
  rules: z.array(policyRuleSchema),
});
