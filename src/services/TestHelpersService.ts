import type { Transaction } from 'sequelize';
import type { AccountRepository } from '../repositories/AccountRepository';
import type { LedgerEntryRepository } from '../repositories/LedgerEntryRepository';
import type { CreateAccountInput, TopUpBalanceInput } from '../types/testHelpers';
import type { Account } from '../models';
import { AccountNotFoundError, AccountNotActiveError } from '../types/errors';

const ACTIVE = 'ACTIVE';

export interface TestHelpersServiceDeps {
  accountRepository: AccountRepository;
  ledgerEntryRepository: LedgerEntryRepository;
  getTransaction: () => Promise<Transaction>;
}

export function createTestHelpersService(deps: TestHelpersServiceDeps) {
  const { accountRepository, ledgerEntryRepository, getTransaction } = deps;

  async function createAccount(input: CreateAccountInput): Promise<Account> {
    const { business_id, currency } = input;
    return accountRepository.create({
      business_id,
      currency,
      available_balance: '0',
      ledger_balance: '0',
      status: 'ACTIVE',
    });
  }

  async function topUpBalance(accountId: string, input: TopUpBalanceInput): Promise<Account> {
    const { amount } = input;
    const transaction = await getTransaction();
    try {
      const account = await accountRepository.findByIdForUpdate(accountId, transaction);
      if (!account) throw new AccountNotFoundError(accountId);
      if (account.status !== ACTIVE) {
        throw new AccountNotActiveError(accountId, account.status);
      }
      const balanceAfter = Number(account.available_balance) + amount;
      await accountRepository.updateBalances(accountId, amount, amount, transaction);
      await ledgerEntryRepository.createForTopUp(
        { account_id: accountId, amount, balance_after: balanceAfter },
        transaction
      );
      await transaction.commit();
      const updated = await accountRepository.findById(accountId);
      if (!updated) throw new AccountNotFoundError(accountId);
      return updated;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  return { createAccount, topUpBalance };
}
