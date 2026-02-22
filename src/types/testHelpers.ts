import { z } from 'zod';

const currencySchema = z.string().length(3, 'Currency must be 3 characters (e.g. USD)');

export const createAccountSchema = z.object({
  business_id: z.string().min(1, 'Business ID is required').max(64),
  currency: currencySchema,
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const topUpBalanceSchema = z.object({
  amount: z.number().positive('Amount must be positive').finite(),
});

export type TopUpBalanceInput = z.infer<typeof topUpBalanceSchema>;

/** Minimal account shape needed to build an API response (avoids controller depending on models). */
export interface AccountLike {
  id: string;
  business_id: string;
  currency: string;
  available_balance: string;
  ledger_balance: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/** API response shape for account resources (create account, top-up). */
export interface AccountResponse {
  id: string;
  businessId: string;
  currency: string;
  availableBalance: number;
  ledgerBalance: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
