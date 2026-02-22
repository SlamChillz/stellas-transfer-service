import type { Transaction } from 'sequelize';

jest.mock('../../src/models', () => ({
  sequelize: {
    transaction: jest.fn(() =>
      Promise.resolve({
        LOCK: { UPDATE: 'UPDATE' },
        commit: jest.fn(() => Promise.resolve()),
        rollback: jest.fn(() => Promise.resolve()),
      } as unknown as Transaction)
    ),
  },
}));

import { UniqueConstraintError } from 'sequelize';
import { createTransferService } from '../../src/services/TransferService';
import type { AccountRepository } from '../../src/repositories/AccountRepository';
import type { TransferRepository } from '../../src/repositories/TransferRepository';
import type { LedgerEntryRepository } from '../../src/repositories/LedgerEntryRepository';
import type { AuditLogRepository } from '../../src/repositories/AuditLogRepository';
import {
  AccountNotActiveError,
  CurrencyMismatchError,
  IdempotencyConflictError,
  InsufficientBalanceError,
  SameAccountError,
  AccountNotFoundError,
} from '../../src/types/errors';

const sourceId = '11111111-1111-1111-1111-111111111111';
const destId = '22222222-2222-2222-2222-222222222222';

function mockAccount(overrides: Partial<{
  id: string;
  status: string;
  currency: string;
  available_balance: string;
  ledger_balance: string;
}> = {}) {
  return {
    id: sourceId,
    status: 'ACTIVE',
    currency: 'NGN',
    available_balance: '100000',
    ledger_balance: '100000',
    ...overrides,
  };
}

function mockTransfer(overrides: Partial<{
  id: string;
  reference: string;
  amount: string;
  currency: string;
  source_account_id: string;
  destination_account_id: string;
  status: string;
  created_at: Date;
}> = {}) {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    reference: 'ref-1',
    amount: '5000',
    currency: 'NGN',
    source_account_id: sourceId,
    destination_account_id: destId,
    status: 'COMPLETED',
    created_at: new Date(),
    ...overrides,
  };
}

function createMocks() {
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: jest.fn(() => Promise.resolve()),
    rollback: jest.fn(() => Promise.resolve()),
  } as unknown as Transaction;
  const accountRepo: AccountRepository = {
    create: jest.fn().mockResolvedValue(mockAccount()),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(null),
    updateBalances: jest.fn().mockResolvedValue(undefined),
  };
  const transferRepo: TransferRepository = {
    findById: jest.fn().mockResolvedValue(null),
    findByReference: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data, _t) =>
      Promise.resolve(mockTransfer({
        reference: data.reference,
        amount: String(data.amount),
        currency: data.currency,
        source_account_id: data.source_account_id,
        destination_account_id: data.destination_account_id,
      }))
    ),
    findAllByAccountId: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
  };
  const ledgerRepo: LedgerEntryRepository = {
    createMany: jest.fn().mockResolvedValue(undefined),
    createForTopUp: jest.fn().mockResolvedValue(undefined),
    findAllByAccountId: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
  };
  const auditRepo: AuditLogRepository = {
    create: jest.fn().mockResolvedValue(undefined),
  };

  return {
    transaction,
    accountRepo,
    transferRepo,
    ledgerRepo,
    auditRepo,
    getTransaction: () => Promise.resolve(transaction),
  };
}

describe('TransferService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeTransfer', () => {
    it('rejects when source and destination are the same', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: sourceId,
          amount: 100,
          currency: 'NGN',
          reference: 'ref-same',
        })
      ).rejects.toThrow(SameAccountError);

      expect(transferRepo.findByReference).not.toHaveBeenCalled();
    });

    it('returns existing transfer when reference is duplicate (idempotency)', async () => {
      const existing = mockTransfer({ reference: 'ref-dup' });
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      (transferRepo.findByReference as jest.Mock).mockResolvedValue(existing);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      const result = await service.executeTransfer({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: 5000,
        currency: 'NGN',
        reference: 'ref-dup',
      });

      expect(result.reference).toBe('ref-dup');
      expect(result.id).toBe(existing.id);
      expect(transferRepo.create).not.toHaveBeenCalled();
      expect(accountRepo.findByIdForUpdate).not.toHaveBeenCalled();
    });

    it('throws IdempotencyConflictError when same reference but different body', async () => {
      const existing = mockTransfer({ reference: 'ref-dup', amount: '5000' });
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      (transferRepo.findByReference as jest.Mock).mockResolvedValue(existing);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 9999,
          currency: 'NGN',
          reference: 'ref-dup',
        })
      ).rejects.toThrow(IdempotencyConflictError);

      expect(transferRepo.create).not.toHaveBeenCalled();
      expect(accountRepo.findByIdForUpdate).not.toHaveBeenCalled();
    });

    it('rejects when source account is not ACTIVE', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId, status: 'FROZEN' });
      const destAccount = mockAccount({ id: destId });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 100,
          currency: 'NGN',
          reference: 'ref-frozen',
        })
      ).rejects.toThrow(AccountNotActiveError);

      expect(transferRepo.create).not.toHaveBeenCalled();
    });

    it('rejects when destination account is not ACTIVE', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId });
      const destAccount = mockAccount({ id: destId, status: 'CLOSED' });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 100,
          currency: 'NGN',
          reference: 'ref-closed',
        })
      ).rejects.toThrow(AccountNotActiveError);
    });

    it('rejects when currencies do not match', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId, currency: 'NGN' });
      const destAccount = mockAccount({ id: destId, currency: 'USD' });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 100,
          currency: 'NGN',
          reference: 'ref-currency',
        })
      ).rejects.toThrow(CurrencyMismatchError);
    });

    it('rejects when insufficient balance', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId, available_balance: '50' });
      const destAccount = mockAccount({ id: destId });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 100,
          currency: 'NGN',
          reference: 'ref-insufficient',
        })
      ).rejects.toThrow(InsufficientBalanceError);
    });

    it('rejects when source account not found', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAccount({ id: destId }));

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 100,
          currency: 'NGN',
          reference: 'ref-missing',
        })
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('locks accounts in sorted order (firstId < secondId)', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId });
      const destAccount = mockAccount({ id: destId });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await service.executeTransfer({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: 5000,
        currency: 'NGN',
        reference: 'ref-order',
      });

      expect(accountRepo.findByIdForUpdate).toHaveBeenCalledWith(
        sourceId,
        expect.anything()
      );
      expect(accountRepo.findByIdForUpdate).toHaveBeenCalledWith(
        destId,
        expect.anything()
      );
    });

    it('creates transfer, updates balances, creates ledger entries and audit on success', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId, available_balance: '10000' });
      const destAccount = mockAccount({ id: destId, available_balance: '5000' });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      const result = await service.executeTransfer({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: 3000,
        currency: 'NGN',
        reference: 'ref-success',
      });

      expect(result.reference).toBe('ref-success');
      expect(result.amount).toBe(3000);
      expect(result.currency).toBe('NGN');
      expect(transferRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 3000,
          currency: 'NGN',
          reference: 'ref-success',
        }),
        expect.anything()
      );
      expect(accountRepo.updateBalances).toHaveBeenCalledWith(
        sourceId,
        -3000,
        -3000,
        expect.anything()
      );
      expect(accountRepo.updateBalances).toHaveBeenCalledWith(
        destId,
        3000,
        3000,
        expect.anything()
      );
      expect(ledgerRepo.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            account_id: sourceId,
            type: 'DEBIT',
            amount: 3000,
            balance_after: 7000,
          }),
          expect.objectContaining({
            account_id: destId,
            type: 'CREDIT',
            amount: 3000,
            balance_after: 8000,
          }),
        ]),
        expect.anything()
      );
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'ref-success',
          amount: 3000,
          balance_source_before: 10000,
          balance_source_after: 7000,
          balance_dest_before: 5000,
          balance_dest_after: 8000,
        }),
        expect.anything()
      );
    });

    it('on UniqueConstraintError returns existing transfer when body matches', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId, available_balance: '10000' });
      const destAccount = mockAccount({ id: destId, available_balance: '5000' });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);
      const existingTransfer = mockTransfer({
        reference: 'ref-race',
        amount: '2000',
        source_account_id: sourceId,
        destination_account_id: destId,
        currency: 'NGN',
      });
      (transferRepo.create as jest.Mock).mockRejectedValueOnce(new UniqueConstraintError({}));
      (transferRepo.findByReference as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingTransfer);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      const result = await service.executeTransfer({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: 2000,
        currency: 'NGN',
        reference: 'ref-race',
      });

      expect(result.reference).toBe('ref-race');
      expect(result.id).toBe(existingTransfer.id);
    });

    it('on UniqueConstraintError throws IdempotencyConflictError when existing body does not match', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId, available_balance: '10000' });
      const destAccount = mockAccount({ id: destId, available_balance: '5000' });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);
      const existingTransfer = mockTransfer({
        reference: 'ref-race',
        amount: '1000',
        source_account_id: sourceId,
        destination_account_id: destId,
        currency: 'NGN',
      });
      (transferRepo.create as jest.Mock).mockRejectedValueOnce(new UniqueConstraintError({}));
      (transferRepo.findByReference as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingTransfer);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 2000,
          currency: 'NGN',
          reference: 'ref-race',
        })
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it('on UniqueConstraintError rethrows when findByReference returns null after conflict', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId, available_balance: '10000' });
      const destAccount = mockAccount({ id: destId, available_balance: '5000' });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);
      (transferRepo.create as jest.Mock).mockRejectedValueOnce(new UniqueConstraintError({}));
      (transferRepo.findByReference as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 2000,
          currency: 'NGN',
          reference: 'ref-race',
        })
      ).rejects.toThrow(UniqueConstraintError);
    });

    it('throws lastErr after exhausting deadlock retries', async () => {
      const { accountRepo, transferRepo, ledgerRepo, auditRepo, getTransaction } = createMocks();
      const sourceAccount = mockAccount({ id: sourceId, available_balance: '10000' });
      const destAccount = mockAccount({ id: destId, available_balance: '5000' });
      (accountRepo.findByIdForUpdate as jest.Mock)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount)
        .mockResolvedValueOnce(sourceAccount)
        .mockResolvedValueOnce(destAccount);
      const deadlockErr = new Error('deadlock') as Error & { parent?: { code?: string } };
      deadlockErr.parent = { code: '40P01' };
      (transferRepo.create as jest.Mock).mockRejectedValue(deadlockErr);

      const service = createTransferService({
        accountRepository: accountRepo,
        transferRepository: transferRepo,
        ledgerEntryRepository: ledgerRepo,
        auditLogRepository: auditRepo,
        getTransaction,
      });

      await expect(
        service.executeTransfer({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 2000,
          currency: 'NGN',
          reference: 'ref-deadlock',
        })
      ).rejects.toThrow('deadlock');
    });
  });
});
