/**
 * Integration tests for test-only endpoints: create account, top-up.
 * Covers validation branches (validateTestHelpers).
 */
import request from 'supertest';
import { app } from '../../src/app';
import { truncateAll, createTwoAccounts, closeDb } from '../helpers/db';

describe('Test helpers API (integration)', () => {
  let accountId: string;

  beforeAll(async () => {
    await truncateAll();
    const ids = await createTwoAccounts();
    accountId = ids.sourceId;
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('POST /api/v1/accounts', () => {
    it('returns 400 when business_id is missing', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({ currency: 'NGN' })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toBeDefined();
      expect(res.body.details.fields).toBeDefined();
    });

    it('returns 400 when currency is invalid length', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .send({ business_id: 'biz-1', currency: 'NG' })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toMatch(/Currency|3/);
    });
  });

  describe('POST /api/v1/accounts/:id/top-up', () => {
    it('returns 400 when amount is negative', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${accountId}/top-up`)
        .send({ amount: -100 })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toMatch(/positive|Amount/);
    });

    it('returns 400 when amount is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${accountId}/top-up`)
        .send({})
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
