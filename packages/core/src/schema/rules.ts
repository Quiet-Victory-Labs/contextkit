import { z } from 'zod';

export const goldenQuerySchema = z.object({
  question: z.string(),
  sql: z.string(),
  dialect: z.string().optional(),
  tags: z.array(z.string()).optional(),
  intent: z.string().optional(),
  expected_rows: z.string().optional(),
  caveats: z.string().optional(),
});

export const businessRuleSchema = z.object({
  name: z.string(),
  definition: z.string(),
  enforcement: z.array(z.string()).optional(),
  avoid: z.array(z.string()).optional(),
  tables: z.array(z.string()).optional(),
  applied_always: z.boolean().optional(),
});

export const guardrailFilterSchema = z.object({
  name: z.string(),
  filter: z.string(),
  tables: z.array(z.string()).optional(),
  reason: z.string(),
});

export const hierarchySchema = z.object({
  name: z.string(),
  levels: z.array(z.string()),
  dataset: z.string(),
  field: z.string().optional(),
});

export const rulesFileSchema = z.object({
  model: z.string(),
  golden_queries: z.array(goldenQuerySchema).optional(),
  business_rules: z.array(businessRuleSchema).optional(),
  guardrail_filters: z.array(guardrailFilterSchema).optional(),
  hierarchies: z.array(hierarchySchema).optional(),
});
