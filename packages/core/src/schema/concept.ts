import { z } from 'zod';

export const evidenceSchema = z.object({ type: z.string(), ref: z.string() });
export const exampleSchema = z.object({ label: z.string(), content: z.string(), kind: z.enum(['do', 'dont']) });

export const conceptFileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  domain: z.string().optional(),
  product_id: z.string().optional(),
  definition: z.string(),
  owner: z.string().optional(),
  status: z.enum(['draft', 'certified', 'deprecated']).optional(),
  certified: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  evidence: z.array(evidenceSchema).optional(),
  depends_on: z.array(z.string()).optional(),
  examples: z.array(exampleSchema).optional(),
  description: z.string().optional(),
});
