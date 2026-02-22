'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('accounts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      business_id: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
      },
      available_balance: {
        type: Sequelize.DECIMAL(20, 4),
        allowNull: false,
        defaultValue: 0,
      },
      ledger_balance: {
        type: Sequelize.DECIMAL(20, 4),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'FROZEN', 'CLOSED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('accounts', ['business_id']);
    await queryInterface.addIndex('accounts', ['business_id', 'currency']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('accounts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_accounts_status";');
  },
};
