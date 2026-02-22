import type { Transaction } from 'sequelize';
import { createTestHelpersService } from '../../src/services/TestHelpersService';
import type { AccountRepository } from '../../src/repositories/AccountRepository';
import type { LedgerEntryRepository } from '../../src/repositories/LedgerEntryRepository';
import { AccountNotFoundError, AccountNotActiveError } from '../../src/types/errors';

const accountId = '11111111-1111-1111-1111-111111111111';

function mockAccount(overrides: Partial<{
  id: string;
  status: string;
  available_balance: string;
  ledger_balance: string;
}> = {}) {
  return {
    id: accountId,
    status: 'ACTIVE',
    available_balance: '10000',
    ledger_balance: '10000',
    ...overrides,
  };
}

function createMocks() {
  const transaction = {
    commit: jest.fn(() => Promise.resolve()),
    rollback: jest.fn(() => Promise.resolve()),
  } as unknown as Transaction;

  const accountRepo: AccountRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(null),
    updateBalances: jest.fn().mockResolvedValue(undefined),
  };

  const ledgerRepo: LedgerEntryRepository = {
    createMany: jest.fn(),
    createForTopUp: jest.fn().mockResolvedValue(undefined),
    findAllByAccountId: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
  };

  return {
    transaction,
    accountRepo,
    ledgerRepo,
    getTransaction: () => Promise.resolve(transaction),
  };
}

describe('TestHelpersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('topUpBalance', () => {
    it('throws AccountNotFoundError when account does not exist', async () => {
      const { accountRepo, ledgerRepo, getTransaction } = createMocks();
      (accountRepo.findByIdForUpdate as jest.Mock).mockResolvedValue(null);

      const service = createTestHelpersService({
        accountRepository: accountRepo,
        ledgerEntryRepository: ledgerRepo,
        getTransaction,
      });

      await expect(
        service.topUpBalance(accountId, { amount: 100 })
      ).rejects.toThrow(AccountNotFoundError);

      expect(ledgerRepo.createForTopUp).not.toHaveBeenCalled();
    });

    it('throws AccountNotActiveError when account is not ACTIVE', async () => {
      const { accountRepo, ledgerRepo, getTransaction } = createMocks();
      (accountRepo.findByIdForUpdate as jest.Mock).mockResolvedValue(
        mockAccount({ status: 'FROZEN' })
      );

      const service = createTestHelpersService({
        accountRepository: accountRepo,
        ledgerEntryRepository: ledgerRepo,
        getTransaction,
      });

      await expect(
        service.topUpBalance(accountId, { amount: 100 })
      ).rejects.toThrow(AccountNotActiveError);

      expect(accountRepo.updateBalances).not.toHaveBeenCalled();
      expect(ledgerRepo.createForTopUp).not.toHaveBeenCalled();
    });

    it('rolls back and rethrows when createForTopUp throws', async () => {
      const { accountRepo, ledgerRepo, getTransaction, transaction } = createMocks();
      (accountRepo.findByIdForUpdate as jest.Mock).mockResolvedValue(mockAccount());
      (ledgerRepo.createForTopUp as jest.Mock).mockRejectedValueOnce(new Error('ledger fail'));

      const service = createTestHelpersService({
        accountRepository: accountRepo,
        ledgerEntryRepository: ledgerRepo,
        getTransaction,
      });

      await expect(
        service.topUpBalance(accountId, { amount: 100 })
      ).rejects.toThrow('ledger fail');

      expect(transaction.rollback).toHaveBeenCalled();
    });

    it('throws AccountNotFoundError when findById after commit returns null', async () => {
      const { accountRepo, ledgerRepo, getTransaction } = createMocks();
      (accountRepo.findByIdForUpdate as jest.Mock).mockResolvedValue(mockAccount());
      (accountRepo.findById as jest.Mock).mockResolvedValue(null);

      const service = createTestHelpersService({
        accountRepository: accountRepo,
        ledgerEntryRepository: ledgerRepo,
        getTransaction,
      });

      await expect(
        service.topUpBalance(accountId, { amount: 100 })
      ).rejects.toThrow(AccountNotFoundError);
    });
  });
});
