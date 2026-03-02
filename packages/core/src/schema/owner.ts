import { z } from 'zod';

export const ownerFileSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  email: z.string().optional(),
  team: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
