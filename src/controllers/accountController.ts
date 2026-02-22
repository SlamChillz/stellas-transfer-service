import { Request, Response } from 'express';
import type { Account } from '../models';
import type { TransferRepository } from '../repositories/TransferRepository';
import type { LedgerEntryRepository } from '../repositories/LedgerEntryRepository';
import type { AccountStatus } from '../repositories/AccountRepository';

function accountToResponse(account: Account) {
  return {
    id: account.id,
    business_id: account.business_id,
    currency: account.currency,
    available_balance: account.available_balance,
    ledger_balance: account.ledger_balance,
    status: account.status,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

export function createGetAccountController(
  getById: (id: string) => Promise<Account>
) {
  return async function getAccount(req: Request, res: Response): Promise<void> {
    const account = await getById(req.params.id);
    res.status(200).json({
      data: { account: accountToResponse(account) },
    });
  };
}

export function createPatchAccountController(
  updateStatus: (id: string, status: AccountStatus) => Promise<Account>
) {
  return async function patchAccount(req: Request, res: Response): Promise<void> {
    const { status } = req.body as { status: AccountStatus };
    const account = await updateStatus(req.params.id, status);
    res.status(200).json({
      data: { account: accountToResponse(account) },
    });
  };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(query: Request['query']): { limit: number; offset: number } {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(query.limit), 10) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, parseInt(String(query.offset), 10) || 0);
  return { limit, offset };
}

export function createListTransfersForAccountController(
  getById: (id: string) => Promise<Account>,
  transferRepository: TransferRepository
) {
  return async function listTransfers(req: Request, res: Response): Promise<void> {
    const accountId = req.params.id;
    await getById(accountId); // 404 if account missing
    const { limit, offset } = parsePagination(req.query);
    const { rows, total } = await transferRepository.findAllByAccountId(accountId, {
      limit,
      offset,
    });
    const transfers = rows.map((t) => ({
      id: t.id,
      reference: t.reference,
      amount: Number(t.amount),
      currency: t.currency,
      sourceAccountId: t.source_account_id,
      destinationAccountId: t.destination_account_id,
      status: t.status,
      createdAt: t.created_at,
    }));
    res.status(200).json({
      data: { transfers },
      meta: { total, limit, offset },
    });
  };
}

export function createListLedgerEntriesForAccountController(
  getById: (id: string) => Promise<Account>,
  ledgerEntryRepository: LedgerEntryRepository
) {
  return async function listLedgerEntries(req: Request, res: Response): Promise<void> {
    const accountId = req.params.id;
    await getById(accountId); // 404 if account missing
    const { limit, offset } = parsePagination(req.query);
    const { rows, total } = await ledgerEntryRepository.findAllByAccountId(accountId, {
      limit,
      offset,
    });
    const ledgerEntries = rows.map((e) => ({
      id: e.id,
      transfer_id: e.transfer_id,
      account_id: e.account_id,
      type: e.type,
      amount: e.amount,
      balance_after: e.balance_after,
      created_at: e.created_at,
    }));
    res.status(200).json({
      data: { ledgerEntries },
      meta: { total, limit, offset },
    });
  };
}
