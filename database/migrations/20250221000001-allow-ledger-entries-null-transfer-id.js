'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ledger_entries', 'transfer_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'transfers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ledger_entries', 'transfer_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'transfers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },
};
