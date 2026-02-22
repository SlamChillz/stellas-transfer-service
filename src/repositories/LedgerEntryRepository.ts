import type { Transaction } from 'sequelize';
import { LedgerEntry } from '../models';

export interface CreateLedgerEntryData {
  transfer_id: string;
  account_id: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  balance_after?: number;
}

export interface TopUpLedgerEntryData {
  account_id: string;
  amount: number;
  balance_after: number;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface LedgerEntriesListResult {
  rows: LedgerEntry[];
  total: number;
}

export interface LedgerEntryRepository {
  createMany(entries: CreateLedgerEntryData[], transaction: Transaction): Promise<void>;
  createForTopUp(data: TopUpLedgerEntryData, transaction: Transaction): Promise<void>;
  findAllByAccountId(accountId: string, params: PaginationParams): Promise<LedgerEntriesListResult>;
}

export function createLedgerEntryRepository(): LedgerEntryRepository {
  return {
    async createMany(entries: CreateLedgerEntryData[], transaction: Transaction): Promise<void> {
      const now = new Date();
      await LedgerEntry.bulkCreate(
        entries.map((e) => ({
          transfer_id: e.transfer_id,
          account_id: e.account_id,
          type: e.type,
          amount: String(e.amount),
          balance_after: e.balance_after != null ? String(e.balance_after) : null,
          created_at: now,
        })),
        { transaction }
      );
    },

    async createForTopUp(
      data: TopUpLedgerEntryData,
      transaction: Transaction
    ): Promise<void> {
      await LedgerEntry.create(
        {
          transfer_id: null,
          account_id: data.account_id,
          type: 'CREDIT',
          amount: String(data.amount),
          balance_after: String(data.balance_after),
        },
        { transaction }
      );
    },

    async findAllByAccountId(
      accountId: string,
      { limit, offset }: PaginationParams
    ): Promise<LedgerEntriesListResult> {
      const { rows, count } = await LedgerEntry.findAndCountAll({
        where: { account_id: accountId },
        order: [['created_at', 'DESC']],
        limit: Math.min(Math.max(1, limit), 100),
        offset: Math.max(0, offset),
      });
      return { rows, total: count };
    },
  };
}
