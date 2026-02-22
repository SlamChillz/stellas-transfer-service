import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

export const createTransferSchema = z.object({
  source_account_id: uuidSchema,
  destination_account_id: uuidSchema,
  amount: z.number().positive('Amount must be positive').finite(),
  currency: z.string().min(1, 'Currency is required').max(3),
  reference: z.string().min(1, 'Reference is required').max(255),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export interface TransferResult {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  sourceAccountId: string;
  destinationAccountId: string;
  status: string;
  createdAt: Date;
}
