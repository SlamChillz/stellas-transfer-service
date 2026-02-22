import { Request, Response, NextFunction } from 'express';
import { isTestEndpointsAllowed } from '../config';
import { errorTypeUrl } from './errorHandler';

/**
 * Blocks access to test-only routes when test endpoints are not allowed (e.g. in production).
 * Responds with 404 so the route appears not to exist.
 */
export function requireTestEndpoints(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isTestEndpointsAllowed) {
    const baseUrl = `${req.protocol}://${req.get('host') ?? ''}`;
    res.status(404).json({
      type: errorTypeUrl('NOT_FOUND', baseUrl),
      code: 'NOT_FOUND',
      message: 'Not found',
    });
    return;
  }
  next();
}
