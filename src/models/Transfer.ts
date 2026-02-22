import { Model, DataTypes, Optional } from 'sequelize';
import type { Sequelize } from 'sequelize';
import type { Account } from './Account';
import type { LedgerEntry } from './LedgerEntry';

export type TransferStatus = 'COMPLETED' | 'REJECTED';

export interface TransferAttributes {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: string;
  currency: string;
  reference: string;
  status: TransferStatus;
  created_at: Date;
}

export type TransferCreationAttributes = Optional<
  TransferAttributes,
  'id' | 'status' | 'created_at'
>;

export class Transfer
  extends Model<TransferAttributes, TransferCreationAttributes>
  implements TransferAttributes
{
  declare id: string;
  declare source_account_id: string;
  declare destination_account_id: string;
  declare amount: string;
  declare currency: string;
  declare reference: string;
  declare status: TransferStatus;
  declare created_at: Date;

  declare getSourceAccount?: () => Promise<Account | null>;
  declare getDestinationAccount?: () => Promise<Account | null>;
  declare getLedgerEntries?: () => Promise<LedgerEntry[]>;

  static associations: {
    sourceAccount: import('sequelize').Association<Transfer, Account>;
    destinationAccount: import('sequelize').Association<Transfer, Account>;
    ledgerEntries: import('sequelize').Association<Transfer, LedgerEntry>;
  };
}

export function initTransferModel(sequelize: Sequelize): typeof Transfer {
  Transfer.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      source_account_id: { type: DataTypes.UUID, allowNull: false },
      destination_account_id: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(20, 4), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false },
      reference: { type: DataTypes.STRING(255), allowNull: false },
      status: {
        type: DataTypes.ENUM('COMPLETED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'COMPLETED',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'transfers',
      underscored: true,
      timestamps: false,
      updatedAt: false,
    }
  );
  return Transfer;
}
