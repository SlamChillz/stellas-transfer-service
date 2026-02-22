/**
 * Integration tests for client error handling (no DB required).
 * Ensures invalid JSON, invalid path params, and body-parser client errors return 4xx with consistent shape.
 */
import request from 'supertest';
import { app, createApp } from '../../src/app';
import { ERROR_CODES } from '../../src/types/errors';

function expectClientErrorShape(body: Record<string, unknown>) {
  expect(body).toHaveProperty('type');
  expect(body).toHaveProperty('code');
  expect(body).toHaveProperty('message');
  expect(typeof body.type).toBe('string');
  expect(typeof body.code).toBe('string');
  expect(typeof body.message).toBe('string');
}

describe('Client error handling (integration)', () => {
  describe('invalid JSON body', () => {
    it('returns 400 VALIDATION_ERROR for malformed JSON on POST /transfers', async () => {
      const res = await request(app)
        .post('/api/v1/transfers')
        .set('Content-Type', 'application/json')
        .send('{ "source_account_id": ') // invalid JSON
        .expect(400);

      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toBe('Invalid JSON in request body');
      expectClientErrorShape(res.body);
    });

    it('returns 400 for invalid JSON on POST /accounts (test endpoint shape)', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .set('Content-Type', 'application/json')
        .send('{ "business_id": ')
        .expect(400);

      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toBe('Invalid JSON in request body');
      expectClientErrorShape(res.body);
    });
  });

  describe('invalid UUID in path param :id', () => {
    it('returns 400 VALIDATION_ERROR for GET /accounts/:id', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/not-a-valid-uuid')
        .expect(400);

      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toMatch(/Invalid UUID|validation/i);
      expectClientErrorShape(res.body);
    });

    it('returns 400 VALIDATION_ERROR for GET /transfers/:id', async () => {
      const res = await request(app)
        .get('/api/v1/transfers/bad-id')
        .expect(400);

      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toMatch(/Invalid UUID|validation/i);
      expectClientErrorShape(res.body);
    });

    it('returns 400 VALIDATION_ERROR for PATCH /accounts/:id with invalid id', async () => {
      const res = await request(app)
        .patch('/api/v1/accounts/truncated-uuid-123')
        .set('Content-Type', 'application/json')
        .send({ status: 'ACTIVE' })
        .expect(400);

      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toMatch(/Invalid UUID|validation/i);
      expectClientErrorShape(res.body);
    });

    it('returns 400 VALIDATION_ERROR for GET /accounts/:id/transfers with invalid id', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/not-uuid/transfers')
        .expect(400);

      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toMatch(/Invalid UUID|validation/i);
      expectClientErrorShape(res.body);
    });

    it('returns 400 VALIDATION_ERROR for GET /accounts/:id/ledger-entries with invalid id', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/xxx/ledger-entries')
        .expect(400);

      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toMatch(/Invalid UUID|validation/i);
      expectClientErrorShape(res.body);
    });
  });

  describe('payload too large (413)', () => {
    it('returns 413 VALIDATION_ERROR when body exceeds limit', async () => {
      const appWithLimit = createApp({ jsonLimit: '50b' });
      const res = await request(appWithLimit)
        .post('/api/v1/transfers')
        .set('Content-Type', 'application/json')
        .send(
          JSON.stringify({
            source_account_id: '11111111-1111-1111-1111-111111111111',
            destination_account_id: '22222222-2222-2222-2222-222222222222',
            amount: 100,
            currency: 'NGN',
            reference: 'ref',
          })
        )
        .expect(413);

      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toBe('Request body too large');
      expectClientErrorShape(res.body);
    });
  });

  describe('response shape and requestId', () => {
    it('includes requestId in error body when x-request-id header is sent', async () => {
      const res = await request(app)
        .get('/api/v1/accounts/invalid-id')
        .set('x-request-id', 'test-request-123')
        .expect(400);

      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.requestId).toBe('test-request-123');
      expectClientErrorShape(res.body);
    });
  });
});
