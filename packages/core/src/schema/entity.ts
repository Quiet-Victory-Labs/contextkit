import { z } from 'zod';

export const entityFieldSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.string().optional(),
});

export const entityFileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  definition: z.string().optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'certified', 'deprecated']).optional(),
  fields: z.array(entityFieldSchema).optional(),
});
