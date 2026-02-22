import type { Transaction } from 'sequelize';
import type { AccountCreationAttributes } from '../models/Account';
import { Account } from '../models';

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export interface AccountRepository {
  create(attrs: AccountCreationAttributes, transaction?: Transaction): Promise<Account>;
  findById(id: string): Promise<Account | null>;
  findByIdForUpdate(id: string, transaction: Transaction): Promise<Account | null>;
  updateStatus(id: string, status: AccountStatus): Promise<Account | null>;
  updateBalances(
    accountId: string,
    availableDelta: number,
    ledgerDelta: number,
    transaction: Transaction
  ): Promise<void>;
}

export function createAccountRepository(): AccountRepository {
  return {
    async create(
      attrs: AccountCreationAttributes,
      transaction?: Transaction
    ): Promise<Account> {
      const account = await Account.create(
        {
          ...attrs,
          available_balance: attrs.available_balance ?? '0',
          ledger_balance: attrs.ledger_balance ?? '0',
          status: attrs.status ?? 'ACTIVE',
        },
        { transaction }
      );
      return account;
    },

    async findById(id: string): Promise<Account | null> {
      return Account.findByPk(id);
    },

    async findByIdForUpdate(id: string, transaction: Transaction): Promise<Account | null> {
      return Account.findByPk(id, {
        lock: transaction.LOCK.UPDATE,
        transaction,
      });
    },

    async updateStatus(id: string, status: AccountStatus): Promise<Account | null> {
      const account = await Account.findByPk(id);
      if (!account) return null;
      await Account.update({ status }, { where: { id } });
      return Account.findByPk(id);
    },

    /**
     * Updates available_balance and ledger_balance. Must only be called within an active transaction.
     */
    async updateBalances(
      accountId: string,
      availableDelta: number,
      ledgerDelta: number,
      transaction: Transaction
    ): Promise<void> {
      const account = await Account.findByPk(accountId, { transaction });
      if (!account) return;
      const available = Number(account.available_balance) + availableDelta;
      const ledger = Number(account.ledger_balance) + ledgerDelta;
      await Account.update(
        {
          available_balance: String(available),
          ledger_balance: String(ledger),
        },
        { where: { id: accountId }, transaction }
      );
    },
  };
}
