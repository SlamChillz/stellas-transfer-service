import { Model, DataTypes, Optional } from 'sequelize';
import type { Sequelize } from 'sequelize';

export interface AuditLogAttributes {
  id: string;
  user_id: string | null;
  transfer_id: string;
  reference: string;
  source_account_id: string;
  destination_account_id: string;
  amount: string;
  currency: string;
  balance_source_before: string;
  balance_source_after: string;
  balance_dest_before: string;
  balance_dest_after: string;
  created_at: Date;
}

export type AuditLogCreationAttributes = Optional<AuditLogAttributes, 'id' | 'user_id' | 'created_at'>;

export class AuditLog
  extends Model<AuditLogAttributes, AuditLogCreationAttributes>
  implements AuditLogAttributes
{
  declare id: string;
  declare user_id: string | null;
  declare transfer_id: string;
  declare reference: string;
  declare source_account_id: string;
  declare destination_account_id: string;
  declare amount: string;
  declare currency: string;
  declare balance_source_before: string;
  declare balance_source_after: string;
  declare balance_dest_before: string;
  declare balance_dest_after: string;
  declare created_at: Date;
}

export function initAuditLogModel(sequelize: Sequelize): typeof AuditLog {
  AuditLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: { type: DataTypes.STRING(64), allowNull: true },
      transfer_id: { type: DataTypes.UUID, allowNull: false },
      reference: { type: DataTypes.STRING(255), allowNull: false },
      source_account_id: { type: DataTypes.UUID, allowNull: false },
      destination_account_id: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(20, 4), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false },
      balance_source_before: { type: DataTypes.DECIMAL(20, 4), allowNull: false },
      balance_source_after: { type: DataTypes.DECIMAL(20, 4), allowNull: false },
      balance_dest_before: { type: DataTypes.DECIMAL(20, 4), allowNull: false },
      balance_dest_after: { type: DataTypes.DECIMAL(20, 4), allowNull: false },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'audit_logs',
      underscored: true,
      timestamps: false,
      updatedAt: false,
    }
  );
  return AuditLog;
}
