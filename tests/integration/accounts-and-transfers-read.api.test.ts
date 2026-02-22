/**
 * Integration tests for GET/PATCH accounts and GET transfers (by id, by reference, list).
 * Requires test DB with migrations. Run: NODE_ENV=test DB_NAME=stellas_transfer_test npm run test:integration
 */
import request from 'supertest';
import { app } from '../../src/app';
import {
  truncateAll,
  createTwoAccounts,
  closeDb,
} from '../helpers/db';

describe('Accounts and transfers read endpoints (integration)', () => {
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

  describe('GET /api/v1/accounts/:id', () => {
    it('returns account by id', async () => {
      const res = await request(app)
        .get(`/api/v1/accounts/${sourceId}`)
        .expect(200);

      expect(res.body.data.account).toBeDefined();
      const a = res.body.data.account;
      expect(a.id).toBe(sourceId);
      expect(a.business_id).toBe('biz-int-1');
      expect(a.currency).toBe('NGN');
      expect(a.available_balance).toBeDefined();
      expect(a.ledger_balance).toBeDefined();
      expect(a.status).toBe('ACTIVE');
      expect(a.created_at).toBeDefined();
      expect(a.updated_at).toBeDefined();
    });

    it('returns 404 for unknown account id', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/00000000-0000-0000-0000-000000000000')
        .expect(404);
      expect(res.body.code).toMatch(/NOT_FOUND|ACCOUNT_NOT_FOUND/);
    });
  });

  describe('PATCH /api/v1/accounts/:id', () => {
    it('updates account status and returns updated account', async () => {
      const res = await request(app)
        .patch(`/api/v1/accounts/${sourceId}`)
        .send({ status: 'FROZEN' })
        .expect(200);

      expect(res.body.data.account).toBeDefined();
      expect(res.body.data.account.status).toBe('FROZEN');
      expect(res.body.data.account.id).toBe(sourceId);

      const getRes = await request(app)
        .get(`/api/v1/accounts/${sourceId}`)
        .expect(200);
      expect(getRes.body.data.account.status).toBe('FROZEN');
    });

    it('returns 400 for invalid status', async () => {
      await request(app)
        .patch(`/api/v1/accounts/${sourceId}`)
        .send({ status: 'INVALID' })
        .expect(400);
    });

    it('returns 404 for unknown account id', async () => {
      await request(app)
        .patch('/api/v1/accounts/00000000-0000-0000-0000-000000000000')
        .send({ status: 'CLOSED' })
        .expect(404);
    });
  });

  describe('GET /api/v1/transfers/:id and GET /api/v1/transfers?reference=', () => {
    it('returns transfer by id after creating one', async () => {
      const createRes = await request(app)
        .post('/api/v1/transfers')
        .send({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 5000,
          currency: 'NGN',
          reference: 'ref-get-by-id',
        })
        .expect(200);

      const transferId = createRes.body.data.transfer.id;

      const getRes = await request(app)
        .get(`/api/v1/transfers/${transferId}`)
        .expect(200);

      expect(getRes.body.data.transfer.id).toBe(transferId);
      expect(getRes.body.data.transfer.reference).toBe('ref-get-by-id');
      expect(getRes.body.data.transfer.amount).toBe(5000);
    });

    it('returns transfer by reference', async () => {
      await request(app)
        .post('/api/v1/transfers')
        .send({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 100,
          currency: 'NGN',
          reference: 'ref-by-query',
        })
        .expect(200);

      const res = await request(app)
        .get('/api/v1/transfers')
        .query({ reference: 'ref-by-query' })
        .expect(200);

      expect(res.body.data.transfer.reference).toBe('ref-by-query');
      expect(res.body.data.transfer.amount).toBe(100);
    });

    it('returns 400 when reference query is missing', async () => {
      await request(app)
        .get('/api/v1/transfers')
        .expect(400);
    });

    it('returns 404 for unknown transfer id', async () => {
      await request(app)
        .get('/api/v1/transfers/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 404 for unknown reference', async () => {
      await request(app)
        .get('/api/v1/transfers')
        .query({ reference: 'no-such-ref' })
        .expect(404);
    });
  });

  describe('GET /api/v1/accounts/:id/transfers', () => {
    it('returns list of transfers for account with pagination', async () => {
      await request(app)
        .post('/api/v1/transfers')
        .send({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 1000,
          currency: 'NGN',
          reference: 'ref-list-1',
        })
        .expect(200);
      await request(app)
        .post('/api/v1/transfers')
        .send({
          source_account_id: destId,
          destination_account_id: sourceId,
          amount: 500,
          currency: 'NGN',
          reference: 'ref-list-2',
        })
        .expect(200);

      const res = await request(app)
        .get(`/api/v1/accounts/${sourceId}/transfers`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(res.body.data.transfers).toBeDefined();
      expect(Array.isArray(res.body.data.transfers)).toBe(true);
      expect(res.body.data.transfers.length).toBe(2);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(0);
    });

    it('returns 404 for unknown account id', async () => {
      await request(app)
        .get('/api/v1/accounts/00000000-0000-0000-0000-000000000000/transfers')
        .expect(404);
    });
  });

  describe('GET /api/v1/accounts/:id/ledger-entries', () => {
    it('returns list of ledger entries for account', async () => {
      await request(app)
        .post('/api/v1/transfers')
        .send({
          source_account_id: sourceId,
          destination_account_id: destId,
          amount: 2000,
          currency: 'NGN',
          reference: 'ref-ledger-list',
        })
        .expect(200);

      const res = await request(app)
        .get(`/api/v1/accounts/${sourceId}/ledger-entries`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(res.body.data.ledgerEntries).toBeDefined();
      expect(Array.isArray(res.body.data.ledgerEntries)).toBe(true);
      expect(res.body.data.ledgerEntries.length).toBe(1);
      expect(res.body.data.ledgerEntries[0].type).toBe('DEBIT');
      expect(res.body.data.ledgerEntries[0].account_id).toBe(sourceId);
      expect(res.body.meta.total).toBe(1);
    });

    it('returns 404 for unknown account id', async () => {
      await request(app)
        .get('/api/v1/accounts/00000000-0000-0000-0000-000000000000/ledger-entries')
        .expect(404);
    });
  });
});
