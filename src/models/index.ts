import { Sequelize } from 'sequelize';
import { databaseConfig } from '../config';
import { initAccountModel, Account } from './Account';
import { initTransferModel, Transfer } from './Transfer';
import { initLedgerEntryModel, LedgerEntry } from './LedgerEntry';
import { initAuditLogModel, AuditLog } from './AuditLog';

const sequelize = new Sequelize(databaseConfig.url, {
  dialect: databaseConfig.dialect,
  logging: databaseConfig.logging,
  pool: databaseConfig.pool,
  define: databaseConfig.define,
});

initAccountModel(sequelize);
initTransferModel(sequelize);
initLedgerEntryModel(sequelize);
initAuditLogModel(sequelize);

// Associations
Account.hasMany(Transfer, { foreignKey: 'source_account_id' });
Transfer.belongsTo(Account, { as: 'sourceAccount', foreignKey: 'source_account_id' });

Account.hasMany(Transfer, { foreignKey: 'destination_account_id' });
Transfer.belongsTo(Account, { as: 'destinationAccount', foreignKey: 'destination_account_id' });

Transfer.hasMany(LedgerEntry, { foreignKey: 'transfer_id' });
LedgerEntry.belongsTo(Transfer, { foreignKey: 'transfer_id' });

Account.hasMany(LedgerEntry, { foreignKey: 'account_id' });
LedgerEntry.belongsTo(Account, { foreignKey: 'account_id' });

export { sequelize, Account, Transfer, LedgerEntry, AuditLog };
