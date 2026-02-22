/**
 * Unit tests for error handler: client errors (invalid JSON, body-parser 413/400) and AppErrors.
 */
import { Request, Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler';
import {
  ERROR_CODES,
  ValidationError,
  AccountNotFoundError,
  IdempotencyConflictError,
} from '../../src/types/errors';

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    protocol: 'http',
    get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function mockResponse(): Response & { _status: number; _body: unknown } {
  const out = {
    _status: 0,
    get _body() {
      return (out as { __body?: unknown }).__body;
    },
    status(code: number) {
      (out as { _status: number })._status = code;
      return out as unknown as Response;
    },
    json(payload: unknown) {
      (out as { __body?: unknown }).__body = payload;
      return out as unknown as Response;
    },
  } as Response & { _status: number; _body: unknown };
  return out;
}

describe('errorHandler', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AppError', () => {
    it('sends statusCode and code from AccountNotFoundError', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = new AccountNotFoundError('acc-123');

      errorHandler(err, req, res, next);

      expect(res._status).toBe(404);
      expect(res._body).toMatchObject({
        code: ERROR_CODES.ACCOUNT_NOT_FOUND,
        message: 'Account not found: acc-123',
      });
    });

    it('sends 409 and IDEMPOTENCY_CONFLICT for IdempotencyConflictError', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = new IdempotencyConflictError();

      errorHandler(err, req, res, next);

      expect(res._status).toBe(409);
      expect(res._body).toMatchObject({
        code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
      });
    });

    it('includes details on ValidationError', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = new ValidationError('Invalid field', { fields: { amount: ['Required'] } });

      errorHandler(err, req, res, next);

      expect(res._status).toBe(400);
      expect(res._body).toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid field',
        details: { fields: { amount: ['Required'] } },
      });
    });
  });

  describe('invalid JSON (SyntaxError from body-parser)', () => {
    it('returns 400 VALIDATION_ERROR with message Invalid JSON in request body', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = Object.assign(new SyntaxError('Unexpected end of JSON input'), {
        status: 400,
        body: '{',
      });

      errorHandler(err, req, res, next);

      expect(res._status).toBe(400);
      expect(res._body).toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid JSON in request body',
      });
    });
  });

  describe('body-parser client errors (413, 400)', () => {
    it('returns 413 VALIDATION_ERROR for entity.too.large', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = Object.assign(new Error('request entity too large'), {
        status: 413,
        type: 'entity.too.large',
      });

      errorHandler(err, req, res, next);

      expect(res._status).toBe(413);
      expect(res._body).toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request body too large',
      });
    });

    it('returns 400 VALIDATION_ERROR for request.size.invalid', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = Object.assign(new Error('request size did not match'), {
        status: 400,
        type: 'request.size.invalid',
      });

      errorHandler(err, req, res, next);

      expect(res._status).toBe(400);
      expect(res._body).toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request size did not match Content-Length',
      });
    });

    it('returns 400 VALIDATION_ERROR for request.aborted', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = Object.assign(new Error('request aborted'), {
        status: 400,
        type: 'request.aborted',
      });

      errorHandler(err, req, res, next);

      expect(res._status).toBe(400);
      expect(res._body).toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request aborted',
      });
    });
  });

  describe('unknown errors', () => {
    it('returns 500 INTERNAL_ERROR for non-AppError and non-body-parser errors', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = new Error('Something broke');

      errorHandler(err, req, res, next);

      expect(res._status).toBe(500);
      expect(res._body).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    });
  });

  describe('requestId', () => {
    it('includes requestId in body when present on request', () => {
      const req = mockRequest({ headers: { 'x-request-id': 'req-456' } });
      const res = mockResponse();
      const err = new ValidationError('Bad');

      errorHandler(err, req, res, next);

      expect(res._body).toMatchObject({
        requestId: 'req-456',
      });
    });
  });
});
