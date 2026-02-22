import { Model, DataTypes, Optional } from 'sequelize';
import type { Sequelize } from 'sequelize';
import type { Transfer } from './Transfer';
import type { Account } from './Account';

export type LedgerEntryType = 'DEBIT' | 'CREDIT';

export interface LedgerEntryAttributes {
  id: string;
  transfer_id: string | null;
  account_id: string;
  type: LedgerEntryType;
  amount: string;
  balance_after: string | null;
  created_at: Date;
}

export type LedgerEntryCreationAttributes = Optional<
  LedgerEntryAttributes,
  'id' | 'transfer_id' | 'balance_after' | 'created_at'
>;

export class LedgerEntry
  extends Model<LedgerEntryAttributes, LedgerEntryCreationAttributes>
  implements LedgerEntryAttributes
{
  declare id: string;
  declare transfer_id: string | null;
  declare account_id: string;
  declare type: LedgerEntryType;
  declare amount: string;
  declare balance_after: string | null;
  declare created_at: Date;

  declare getTransfer?: () => Promise<Transfer | null>;
  declare getAccount?: () => Promise<Account | null>;

  static associations: {
    transfer: import('sequelize').Association<LedgerEntry, Transfer>;
    account: import('sequelize').Association<LedgerEntry, Account>;
  };
}

export function initLedgerEntryModel(sequelize: Sequelize): typeof LedgerEntry {
  LedgerEntry.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      transfer_id: { type: DataTypes.UUID, allowNull: true },
      account_id: { type: DataTypes.UUID, allowNull: false },
      type: {
        type: DataTypes.ENUM('DEBIT', 'CREDIT'),
        allowNull: false,
      },
      amount: { type: DataTypes.DECIMAL(20, 4), allowNull: false },
      balance_after: { type: DataTypes.DECIMAL(20, 4), allowNull: true },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'ledger_entries',
      underscored: true,
      timestamps: false,
      updatedAt: false,
    }
  );
  return LedgerEntry;
}
