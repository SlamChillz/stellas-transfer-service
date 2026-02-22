import { Model, DataTypes, Optional } from 'sequelize';
import type { Sequelize } from 'sequelize';
import type { Transfer } from './Transfer';
import type { LedgerEntry } from './LedgerEntry';

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export interface AccountAttributes {
  id: string;
  business_id: string;
  currency: string;
  available_balance: string;
  ledger_balance: string;
  status: AccountStatus;
  created_at: Date;
  updated_at: Date;
}

export type AccountCreationAttributes = Optional<
  AccountAttributes,
  'id' | 'created_at' | 'updated_at'
>;

export class Account
  extends Model<AccountAttributes, AccountCreationAttributes>
  implements AccountAttributes
{
  declare id: string;
  declare business_id: string;
  declare currency: string;
  declare available_balance: string;
  declare ledger_balance: string;
  declare status: AccountStatus;
  declare created_at: Date;
  declare updated_at: Date;

  declare getTransfersAsSource?: () => Promise<Transfer[]>;
  declare getTransfersAsDestination?: () => Promise<Transfer[]>;
  declare getLedgerEntries?: () => Promise<LedgerEntry[]>;

  static associations: {
    transfersAsSource: import('sequelize').Association<Account, Transfer>;
    transfersAsDestination: import('sequelize').Association<Account, Transfer>;
    ledgerEntries: import('sequelize').Association<Account, LedgerEntry>;
  };
}

export function initAccountModel(sequelize: Sequelize): typeof Account {
  Account.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      business_id: { type: DataTypes.STRING(64), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false },
      available_balance: {
        type: DataTypes.DECIMAL(20, 4),
        allowNull: false,
        defaultValue: 0,
      },
      ledger_balance: {
        type: DataTypes.DECIMAL(20, 4),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'FROZEN', 'CLOSED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'accounts',
      underscored: true,
      timestamps: true,
    }
  );
  return Account;
}
