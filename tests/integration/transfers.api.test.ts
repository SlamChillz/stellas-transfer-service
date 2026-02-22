/**
 * Integration tests for POST /api/v1/transfers.
 * Require a running Postgres test DB (e.g. DB_NAME=stellas_transfer_test) with migrations run.
 * Run: NODE_ENV=test DB_NAME=stellas_transfer_test npm run db:migrate
 * Then: npm test -- --testPathPattern=integration
 */
import request from 'supertest';
import { app } from '../../src/app';
import {
  truncateAll,
  createTwoAccounts,
  getAccountBalance,
  getTransferCount,
  getLedgerEntryCount,
  getLedgerBalanceForAccount,
  closeDb,
} from '../helpers/db';

describe('POST /api/v1/transfers (integration)', () => {
  let sourceId: string;
  let destId: string;

  beforeAll(async () => {
    await truncateAll();
    const ids = await createTwoAccounts();
    sourceId = ids.sourceId;
    destId = ids.destId;
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    await truncateAll();
    const ids = await createTwoAccounts();
    sourceId = ids.sourceId;
    destId = ids.destId;
  });

  it('creates transfer and updates balances and ledger', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: 10000,
        currency: 'NGN',
        reference: 'ref-int-1',
      })
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.transfer).toBeDefined();
    const t = res.body.data.transfer;
    expect(t.reference).toBe('ref-int-1');
    expect(t.amount).toBe(10000);
    expect(t.currency).toBe('NGN');
    expect(t.sourceAccountId).toBe(sourceId);
    expect(t.destinationAccountId).toBe(destId);
    expect(t.status).toBe('COMPLETED');
    expect(t.id).toBeDefined();
    expect(t.createdAt).toBeDefined();

    const sourceBal = await getAccountBalance(sourceId);
    const destBal = await getAccountBalance(destId);
    expect(sourceBal.available).toBe(90000);
    expect(sourceBal.ledger).toBe(90000);
    expect(destBal.available).toBe(60000);
    expect(destBal.ledger).toBe(60000);

    expect(await getTransferCount()).toBe(1);
    expect(await getLedgerEntryCount()).toBe(2);
  });

  it('account ledger_balance equals reconstructed balance from ledger entries', async () => {
    const createRes1 = await request(app)
      .post('/api/v1/accounts')
      .send({ business_id: 'biz-ledger-1', currency: 'NGN' })
      .expect(201);
    const createRes2 = await request(app)
      .post('/api/v1/accounts')
      .send({ business_id: 'biz-ledger-2', currency: 'NGN' })
      .expect(201);
    const acc1Id = createRes1.body.data.account.id;
    const acc2Id = createRes2.body.data.account.id;

    await request(app)
      .post(`/api/v1/accounts/${acc1Id}/top-up`)
      .send({ amount: 100000 })
      .expect(200);
    await request(app)
      .post(`/api/v1/accounts/${acc2Id}/top-up`)
      .send({ amount: 50000 })
      .expect(200);

    await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: acc1Id,
        destination_account_id: acc2Id,
        amount: 10000,
        currency: 'NGN',
        reference: 'ref-ledger-invariant',
      })
      .expect(200);

    const sourceBal = await getAccountBalance(acc1Id);
    const destBal = await getAccountBalance(acc2Id);
    const sourceLedgerReconstructed = await getLedgerBalanceForAccount(acc1Id);
    const destLedgerReconstructed = await getLedgerBalanceForAccount(acc2Id);
    expect(sourceLedgerReconstructed).toBe(sourceBal.ledger);
    expect(destLedgerReconstructed).toBe(destBal.ledger);
  });

  it('returns same response for duplicate reference (idempotency)', async () => {
    const body = {
      source_account_id: sourceId,
      destination_account_id: destId,
      amount: 5000,
      currency: 'NGN',
      reference: 'ref-idem',
    };

    const res1 = await request(app).post('/api/v1/transfers').send(body).expect(200);
    const res2 = await request(app).post('/api/v1/transfers').send(body).expect(200);

    expect(res1.body.data.transfer.id).toBe(res2.body.data.transfer.id);
    expect(res1.body.data.transfer.reference).toBe('ref-idem');
    expect(res2.body.data.transfer.reference).toBe('ref-idem');

    expect(await getTransferCount()).toBe(1);
    expect(await getLedgerEntryCount()).toBe(2);

    const sourceBal = await getAccountBalance(sourceId);
    expect(sourceBal.available).toBe(95000);
  });

  it('returns 409 IDEMPOTENCY_CONFLICT when same reference sent with different body', async () => {
    const first = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: 1000,
        currency: 'NGN',
        reference: 'ref-conflict',
      })
      .expect(200);

    expect(first.body.data.transfer.reference).toBe('ref-conflict');
    expect(first.body.data.transfer.amount).toBe(1000);

    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: 2000,
        currency: 'NGN',
        reference: 'ref-conflict',
      })
      .expect(409);

    expect(res.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(res.body.message).toContain('reference');
    expect(await getTransferCount()).toBe(1);
    const sourceBal = await getAccountBalance(sourceId);
    expect(sourceBal.available).toBe(99000);
  });

  it('rejects insufficient balance with 422 and does not change balances', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: 200000,
        currency: 'NGN',
        reference: 'ref-insufficient',
      })
      .expect(422);

    expect(res.body.code).toBe('INSUFFICIENT_BALANCE');
    expect(res.body.message).toContain('Insufficient');

    const sourceBal = await getAccountBalance(sourceId);
    const destBal = await getAccountBalance(destId);
    expect(sourceBal.available).toBe(100000);
    expect(destBal.available).toBe(50000);
    expect(await getTransferCount()).toBe(0);
    expect(await getLedgerEntryCount()).toBe(0);
  });

  it('rejects invalid body with 400 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: -100,
        currency: 'NGN',
        reference: 'ref-bad',
      })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects currency mismatch with 422', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: 100,
        currency: 'USD',
        reference: 'ref-currency',
      })
      .expect(422);

    expect(res.body.code).toBe('CURRENCY_MISMATCH');
    expect(await getTransferCount()).toBe(0);
    expect(await getLedgerEntryCount()).toBe(0);
  });
});
