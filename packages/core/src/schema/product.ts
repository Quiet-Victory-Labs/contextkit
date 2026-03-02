import { z } from 'zod';

export const productFileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'certified', 'deprecated']).optional(),
});
