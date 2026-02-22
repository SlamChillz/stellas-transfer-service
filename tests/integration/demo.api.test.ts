/**
 * Integration tests for POST /api/v1/demo/concurrent-transfers (test-only endpoint).
 * Require test DB and test endpoints enabled.
 */
import request from 'supertest';
import { app } from '../../src/app';
import {
  truncateAll,
  createTwoAccounts,
  getAccountBalance,
  closeDb,
} from '../helpers/db';

describe('POST /api/v1/demo/concurrent-transfers (integration)', () => {
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

  it('runs bidirectional concurrent transfers and returns summary', async () => {
    const res = await request(app)
      .post('/api/v1/demo/concurrent-transfers')
      .send({
        source_account_id: sourceId,
        destination_account_id: destId,
        currency: 'NGN',
        source_to_dest: { count: 2, amount_per_transfer: 1000 },
        dest_to_source: { count: 1, amount_per_transfer: 500 },
      })
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.scenario).toBe('concurrent_transfers_bidirectional');
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary.source_balance_before).toBe(100000);
    expect(res.body.data.summary.destination_balance_before).toBe(50000);
    expect(res.body.data.summary.source_to_dest.requested).toBe(2);
    expect(res.body.data.summary.dest_to_source.requested).toBe(1);
    expect(res.body.data.transfers).toHaveLength(3);

    const sourceBal = await getAccountBalance(sourceId);
    const destBal = await getAccountBalance(destId);
    expect(sourceBal.available).toBe(100000 - 2000 + 500);
    expect(destBal.available).toBe(50000 + 2000 - 500);
  });

  it('returns 400 when validation fails (same source and destination)', async () => {
    const res = await request(app)
      .post('/api/v1/demo/concurrent-transfers')
      .send({
        source_account_id: sourceId,
        destination_account_id: sourceId,
        currency: 'NGN',
        source_to_dest: { count: 1, amount_per_transfer: 100 },
        dest_to_source: { count: 1, amount_per_transfer: 100 },
      })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toContain('Source and destination');
  });

  it('returns 400 when count is out of range', async () => {
    const res = await request(app)
      .post('/api/v1/demo/concurrent-transfers')
      .send({
        source_account_id: sourceId,
        destination_account_id: destId,
        currency: 'NGN',
        source_to_dest: { count: 0, amount_per_transfer: 100 },
        dest_to_source: { count: 1, amount_per_transfer: 100 },
      })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when account does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app)
      .post('/api/v1/demo/concurrent-transfers')
      .send({
        source_account_id: fakeId,
        destination_account_id: destId,
        currency: 'NGN',
        source_to_dest: { count: 1, amount_per_transfer: 100 },
        dest_to_source: { count: 1, amount_per_transfer: 100 },
      })
      .expect(404);

    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
  });
});
