import { z } from 'zod';

export const patchAccountSchema = z.object({
  status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED'], {
    errorMap: () => ({ message: 'status must be one of ACTIVE, FROZEN, CLOSED' }),
  }),
});

export type PatchAccountInput = z.infer<typeof patchAccountSchema>;
