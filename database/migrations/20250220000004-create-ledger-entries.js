'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ledger_entries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      transfer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'transfers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      account_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      type: {
        type: Sequelize.ENUM('DEBIT', 'CREDIT'),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(20, 4),
        allowNull: false,
      },
      balance_after: {
        type: Sequelize.DECIMAL(20, 4),
        allowNull: true,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('ledger_entries', ['transfer_id']);
    await queryInterface.addIndex('ledger_entries', ['account_id']);
    await queryInterface.addIndex('ledger_entries', ['account_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ledger_entries');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ledger_entries_type";');
  },
};
