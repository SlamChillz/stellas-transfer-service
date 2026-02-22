import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

const directionConfigSchema = z.object({
  count: z.number().int().min(1, 'Count must be at least 1').max(100),
  amount_per_transfer: z.number().positive('Amount must be positive').finite(),
});

export const concurrentTransfersDemoSchema = z
  .object({
    source_account_id: uuidSchema,
    destination_account_id: uuidSchema,
    currency: z.string().min(1, 'Currency is required').max(3),
    source_to_dest: directionConfigSchema,
    dest_to_source: directionConfigSchema,
  })
  .refine((data) => data.source_account_id !== data.destination_account_id, {
    message: 'Source and destination accounts must be different',
    path: ['source_account_id', 'destination_account_id'],
  });

export type ConcurrentTransfersDemoInput = z.infer<typeof concurrentTransfersDemoSchema>;

export type TransferDirection = 'source_to_destination' | 'destination_to_source';

export interface PerTransferResult {
  reference: string;
  direction: TransferDirection;
  amount: number;
  status: 'completed' | 'failed';
  transfer_id?: string;
  error_code?: string;
  error_message?: string;
}

export interface ConcurrentTransfersDemoSummary {
  duration_ms: number;
  source_account_id: string;
  destination_account_id: string;
  source_balance_before: number;
  source_balance_after: number;
  destination_balance_before: number;
  destination_balance_after: number;
  source_to_dest: { requested: number; succeeded: number; failed: number };
  dest_to_source: { requested: number; succeeded: number; failed: number };
}

export interface ConcurrentTransfersDemoResponse {
  scenario: 'concurrent_transfers_bidirectional';
  summary: ConcurrentTransfersDemoSummary;
  transfers: PerTransferResult[];
}
