'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT is_nullable FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'ledger_entries' AND column_name = 'transfer_id'`
    );
    if (rows.length > 0 && rows[0].is_nullable === 'NO') {
      await queryInterface.sequelize.query(
        'ALTER TABLE ledger_entries ALTER COLUMN transfer_id DROP NOT NULL;'
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE ledger_entries ALTER COLUMN transfer_id SET NOT NULL;'
    );
  },
};
