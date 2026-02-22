import { Request, Response } from 'express';
import type {
  AccountLike,
  AccountResponse,
  CreateAccountInput,
  TopUpBalanceInput,
} from '../types/testHelpers';

function toAccountResponse(account: AccountLike): AccountResponse {
  return {
    id: account.id,
    businessId: account.business_id,
    currency: account.currency,
    availableBalance: Number(account.available_balance),
    ledgerBalance: Number(account.ledger_balance),
    status: account.status,
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  };
}

export function createCreateAccountController(
  createAccount: (input: CreateAccountInput) => Promise<AccountLike>
) {
  return async function postCreateAccount(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateAccountInput;
    const account = await createAccount(input);
    res.status(201).json({
      data: { account: toAccountResponse(account) },
    });
  };
}

export function createTopUpBalanceController(
  topUpBalance: (accountId: string, input: TopUpBalanceInput) => Promise<AccountLike>
) {
  return async function postTopUpBalance(req: Request, res: Response): Promise<void> {
    const accountId = req.params.id as string;
    const input = req.body as TopUpBalanceInput;
    const account = await topUpBalance(accountId, input);
    res.status(200).json({
      data: { account: toAccountResponse(account) },
    });
  };
}
