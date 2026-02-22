'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      user_id: { type: Sequelize.STRING(64), allowNull: true },
      transfer_id: { type: Sequelize.UUID, allowNull: false },
      reference: { type: Sequelize.STRING(255), allowNull: false },
      source_account_id: { type: Sequelize.UUID, allowNull: false },
      destination_account_id: { type: Sequelize.UUID, allowNull: false },
      amount: { type: Sequelize.DECIMAL(20, 4), allowNull: false },
      currency: { type: Sequelize.STRING(3), allowNull: false },
      balance_source_before: { type: Sequelize.DECIMAL(20, 4), allowNull: false },
      balance_source_after: { type: Sequelize.DECIMAL(20, 4), allowNull: false },
      balance_dest_before: { type: Sequelize.DECIMAL(20, 4), allowNull: false },
      balance_dest_after: { type: Sequelize.DECIMAL(20, 4), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('audit_logs', ['transfer_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
