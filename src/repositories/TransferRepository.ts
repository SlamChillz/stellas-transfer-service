import type { Transaction } from 'sequelize';
import { Op } from 'sequelize';
import { Transfer } from '../models';

export interface CreateTransferData {
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  currency: string;
  reference: string;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface TransfersListResult {
  rows: Transfer[];
  total: number;
}

export interface TransferRepository {
  findById(id: string): Promise<Transfer | null>;
  findByReference(reference: string): Promise<Transfer | null>;
  create(data: CreateTransferData, transaction: Transaction): Promise<Transfer>;
  findAllByAccountId(accountId: string, params: PaginationParams): Promise<TransfersListResult>;
}

export function createTransferRepository(): TransferRepository {
  return {
    async findById(id: string): Promise<Transfer | null> {
      return Transfer.findByPk(id);
    },

    async findByReference(reference: string): Promise<Transfer | null> {
      return Transfer.findOne({ where: { reference } });
    },

    async create(data: CreateTransferData, transaction: Transaction): Promise<Transfer> {
      return Transfer.create(
        {
          source_account_id: data.source_account_id,
          destination_account_id: data.destination_account_id,
          amount: String(data.amount),
          currency: data.currency,
          reference: data.reference,
          status: 'COMPLETED',
        },
        { transaction }
      );
    },

    async findAllByAccountId(
      accountId: string,
      { limit, offset }: PaginationParams
    ): Promise<TransfersListResult> {
      const { rows, count } = await Transfer.findAndCountAll({
        where: {
          [Op.or]: [
            { source_account_id: accountId },
            { destination_account_id: accountId },
          ],
        },
        order: [['created_at', 'DESC']],
        limit: Math.min(Math.max(1, limit), 100),
        offset: Math.max(0, offset),
      });
      return { rows, total: count };
    },
  };
}
