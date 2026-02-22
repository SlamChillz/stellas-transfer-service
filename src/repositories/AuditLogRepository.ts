import type { Transaction } from 'sequelize';
import { AuditLog } from '../models';

export interface CreateAuditLogData {
  transfer_id: string;
  reference: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  currency: string;
  balance_source_before: number;
  balance_source_after: number;
  balance_dest_before: number;
  balance_dest_after: number;
  user_id?: string | null;
}

export interface AuditLogRepository {
  create(data: CreateAuditLogData, transaction: Transaction): Promise<void>;
}

const MOCK_USER_ID = 'system';

export function createAuditLogRepository(): AuditLogRepository {
  return {
    async create(data: CreateAuditLogData, transaction: Transaction): Promise<void> {
      await AuditLog.create(
        {
          user_id: data.user_id ?? MOCK_USER_ID,
          transfer_id: data.transfer_id,
          reference: data.reference,
          source_account_id: data.source_account_id,
          destination_account_id: data.destination_account_id,
          amount: String(data.amount),
          currency: data.currency,
          balance_source_before: String(data.balance_source_before),
          balance_source_after: String(data.balance_source_after),
          balance_dest_before: String(data.balance_dest_before),
          balance_dest_after: String(data.balance_dest_after),
          created_at: new Date(),
        },
        { transaction }
      );
    },
  };
}
