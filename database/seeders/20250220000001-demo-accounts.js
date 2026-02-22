'use strict';

const { randomUUID } = require('crypto');

const ACCOUNT_1_ID = '9816b2b9-8db7-44cc-abdc-172fde645d32';
const ACCOUNT_2_ID = '8a6823d7-c652-4d67-8859-0e62ae5b8f52';
const TOP_UP_AMOUNT = 100000;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    const now = new Date();

    // Remove existing demo accounts and their ledger entries (so restart re-seeds cleanly)
    await queryInterface.bulkDelete('ledger_entries', {
      account_id: { [Op.in]: [ACCOUNT_1_ID, ACCOUNT_2_ID] },
    }, {});
    await queryInterface.bulkDelete('accounts', { id: { [Op.in]: [ACCOUNT_1_ID, ACCOUNT_2_ID] } }, {});

    await queryInterface.bulkInsert('accounts', [
      {
        id: ACCOUNT_1_ID,
        business_id: 'biz-001',
        currency: 'NGN',
        available_balance: TOP_UP_AMOUNT,
        ledger_balance: TOP_UP_AMOUNT,
        status: 'ACTIVE',
        created_at: now,
        updated_at: now,
      },
      {
        id: ACCOUNT_2_ID,
        business_id: 'biz-002',
        currency: 'NGN',
        available_balance: TOP_UP_AMOUNT,
        ledger_balance: TOP_UP_AMOUNT,
        status: 'ACTIVE',
        created_at: now,
        updated_at: now,
      },
    ], {});

    // Ledger entries for the initial top-up (CREDIT, no transfer)
    await queryInterface.bulkInsert('ledger_entries', [
      {
        id: randomUUID(),
        transfer_id: null,
        account_id: ACCOUNT_1_ID,
        type: 'CREDIT',
        amount: TOP_UP_AMOUNT,
        balance_after: TOP_UP_AMOUNT,
        created_at: now,
      },
      {
        id: randomUUID(),
        transfer_id: null,
        account_id: ACCOUNT_2_ID,
        type: 'CREDIT',
        amount: TOP_UP_AMOUNT,
        balance_after: TOP_UP_AMOUNT,
        created_at: now,
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('ledger_entries', {
      account_id: { [Op.in]: [ACCOUNT_1_ID, ACCOUNT_2_ID] },
    }, {});
    await queryInterface.bulkDelete('accounts', { id: { [Op.in]: [ACCOUNT_1_ID, ACCOUNT_2_ID] } }, {});
  },
};
