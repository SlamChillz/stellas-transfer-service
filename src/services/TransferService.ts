import type { Transaction } from 'sequelize';
import { UniqueConstraintError } from 'sequelize';
import type { AccountRepository } from '../repositories/AccountRepository';
import type { TransferRepository } from '../repositories/TransferRepository';
import type { LedgerEntryRepository } from '../repositories/LedgerEntryRepository';
import type { AuditLogRepository } from '../repositories/AuditLogRepository';
import type { CreateTransferInput, TransferResult } from '../types/transfer';
import {
  AccountNotFoundError,
  AccountNotActiveError,
  CurrencyMismatchError,
  IdempotencyConflictError,
  InsufficientBalanceError,
  SameAccountError,
} from '../types/errors';

const ACTIVE = 'ACTIVE';

export interface TransferServiceDeps {
  accountRepository: AccountRepository;
  transferRepository: TransferRepository;
  ledgerEntryRepository: LedgerEntryRepository;
  auditLogRepository: AuditLogRepository;
  getTransaction: () => Promise<Transaction>;
}

export function createTransferService(deps: TransferServiceDeps) {
  const {
    accountRepository,
    transferRepository,
    ledgerEntryRepository,
    auditLogRepository,
    getTransaction,
  } = deps;

  async function executeTransfer(input: CreateTransferInput): Promise<TransferResult> {
    const { source_account_id, destination_account_id, amount, currency, reference } = input;

    if (source_account_id === destination_account_id) {
      throw new SameAccountError();
    }

    // Idempotency: return existing transfer if reference already used (request body must match)
    const existing = await transferRepository.findByReference(reference);
    if (existing) {
      if (!requestMatchesExisting(input, existing)) {
        throw new IdempotencyConflictError();
      }
      return toTransferResult(existing);
    }

    const maxDeadlockRetries = 3;
    let lastErr: unknown;

    for (let attempt = 0; attempt < maxDeadlockRetries; attempt++) {
      const transaction = await getTransaction();
      try {
        // All balance updates and ledger/audit writes occur only inside this transaction.
        // Lock in consistent order to avoid deadlocks
        const [firstId, secondId] = [source_account_id, destination_account_id].sort();
        const firstAccount = await accountRepository.findByIdForUpdate(firstId, transaction);
        const secondAccount = await accountRepository.findByIdForUpdate(secondId, transaction);

        const sourceAccount =
          source_account_id === firstId ? firstAccount : secondAccount;
        const destAccount =
          destination_account_id === firstId ? firstAccount : secondAccount;

        if (!sourceAccount) throw new AccountNotFoundError(source_account_id);
        if (!destAccount) throw new AccountNotFoundError(destination_account_id);

        if (sourceAccount.status !== ACTIVE) {
          throw new AccountNotActiveError(source_account_id, sourceAccount.status);
        }
        if (destAccount.status !== ACTIVE) {
          throw new AccountNotActiveError(destination_account_id, destAccount.status);
        }

        if (sourceAccount.currency !== currency || destAccount.currency !== currency) {
          throw new CurrencyMismatchError();
        }

        const sourceAvailable = Number(sourceAccount.available_balance);
        if (sourceAvailable < amount) {
          throw new InsufficientBalanceError();
        }

        const destAvailable = Number(destAccount.available_balance);

        const transfer = await transferRepository.create(
          {
            source_account_id,
            destination_account_id,
            amount,
            currency,
            reference,
          },
          transaction
        );

        await accountRepository.updateBalances(
          source_account_id,
          -amount,
          -amount,
          transaction
        );
        await accountRepository.updateBalances(
          destination_account_id,
          amount,
          amount,
          transaction
        );

        const sourceBalanceAfter = sourceAvailable - amount;
        const destBalanceAfter = destAvailable + amount;

        await ledgerEntryRepository.createMany(
          [
            {
              transfer_id: transfer.id,
              account_id: source_account_id,
              type: 'DEBIT',
              amount,
              balance_after: sourceBalanceAfter,
            },
            {
              transfer_id: transfer.id,
              account_id: destination_account_id,
              type: 'CREDIT',
              amount,
              balance_after: destBalanceAfter,
            },
          ],
          transaction
        );

        await auditLogRepository.create(
          {
            transfer_id: transfer.id,
            reference,
            source_account_id,
            destination_account_id,
            amount,
            currency,
            balance_source_before: sourceAvailable,
            balance_source_after: sourceBalanceAfter,
            balance_dest_before: destAvailable,
            balance_dest_after: destBalanceAfter,
          },
          transaction
        );

        await transaction.commit();
        return toTransferResult(transfer);
      } catch (err) {
        await transaction.rollback();
        lastErr = err;
        const isDeadlock =
          err && typeof err === 'object' && (err as { parent?: { code?: string } }).parent?.code === '40P01';
        if (isDeadlock && attempt < maxDeadlockRetries - 1) {
          continue;
        }
        // Concurrent duplicate reference: another request created it; return existing if body matches
        if (err instanceof UniqueConstraintError) {
          const existingAfter = await transferRepository.findByReference(reference);
          if (existingAfter) {
            if (!requestMatchesExisting(input, existingAfter)) {
              throw new IdempotencyConflictError();
            }
            return toTransferResult(existingAfter);
          }
        }
        throw err;
      }
    }
    throw lastErr;
  }

  return { executeTransfer };
}

/** Returns true if the request body matches the existing transfer (idempotency). */
function requestMatchesExisting(
  input: CreateTransferInput,
  existing: {
    source_account_id: string;
    destination_account_id: string;
    amount: string;
    currency: string;
  }
): boolean {
  return (
    existing.source_account_id === input.source_account_id &&
    existing.destination_account_id === input.destination_account_id &&
    existing.currency === input.currency &&
    Number(existing.amount) === input.amount
  );
}

function toTransferResult(transfer: {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  source_account_id: string;
  destination_account_id: string;
  status: string;
  created_at: Date;
}): TransferResult {
  return {
    id: transfer.id,
    reference: transfer.reference,
    amount: Number(transfer.amount),
    currency: transfer.currency,
    sourceAccountId: transfer.source_account_id,
    destinationAccountId: transfer.destination_account_id,
    status: transfer.status,
    createdAt: transfer.created_at,
  };
}
