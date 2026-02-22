'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transfers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      source_account_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      destination_account_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      amount: {
        type: Sequelize.DECIMAL(20, 4),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
      },
      reference: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('COMPLETED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'COMPLETED',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('transfers', ['reference'], { unique: true });
    await queryInterface.addIndex('transfers', ['source_account_id']);
    await queryInterface.addIndex('transfers', ['destination_account_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('transfers');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_transfers_status";');
  },
};
