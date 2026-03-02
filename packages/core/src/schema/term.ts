import { z } from 'zod';

export const termFileSchema = z.object({
  id: z.string(),
  term: z.string().optional(),
  definition: z.string(),
  synonyms: z.array(z.string()).optional(),
  maps_to: z.array(z.string()).optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
