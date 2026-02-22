import { Request, Response } from 'express';

jest.mock('../../src/config', () => ({
  isTestEndpointsAllowed: false,
  env: { LOG_LEVEL: 'info', NODE_ENV: 'test' },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { requireTestEndpoints } = require('../../src/middlewares/requireTestEndpoints');

describe('requireTestEndpoints', () => {
  it('responds with 404 and NOT_FOUND when test endpoints are not allowed', () => {
    const req = {
      protocol: 'http',
      get: jest.fn((name: string) => (name === 'host' ? 'localhost:3000' : undefined)),
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    requireTestEndpoints(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'Not found',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
