import { Request, Response, NextFunction } from 'express';
import { AppError, ERROR_CODES, ValidationError } from '../types/errors';
import { logger } from '../utils/logger';
import { env } from '../config';

/** Body-parser / express.json() invalid JSON error (SyntaxError with status 400). */
function isJsonSyntaxError(err: unknown): err is SyntaxError & { status?: number; body?: unknown } {
  return (
    err instanceof SyntaxError &&
    (err as { status?: number }).status === 400 &&
    'body' in err
  );
}

/** Body-parser errors that are client-caused (have status 4xx and type). */
function isBodyParserClientError(
  err: unknown
): err is Error & { status?: number; statusCode?: number; type?: string } {
  if (!(err instanceof Error)) return false;
  const status = (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode;
  const type = (err as { type?: string }).type;
  if (status === 413 && type === 'entity.too.large') return true;
  if (status === 400 && (type === 'request.aborted' || type === 'request.size.invalid'))
    return true;
  return false;
}

const REQUEST_ID_HEADER = 'x-request-id';

/** In dev, type is full URL to /docs#CODE (pass baseUrl from req so hostname is included). Use for all error responses. */
export function errorTypeUrl(code: string, baseUrl?: string): string {
  if (env.NODE_ENV === 'production') {
    return `https://api.stellas.dev/errors/${code}`;
  }
  const base = baseUrl ?? '';
  return base ? `${base}/docs#${code}` : `/docs#${code}`;
}

/**
 * Wraps async route handlers so rejected promises are passed to the error middleware.
 * Without this, Express 4 does not forward thrown/rejected errors to errorHandler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function getRequestId(req: Request): string | undefined {
  const fromHeader = req.headers[REQUEST_ID_HEADER];
  if (typeof fromHeader === 'string') return fromHeader;
  return (req as Request & { requestId?: string }).requestId;
}

function getBaseUrl(req: Request): string {
  return `${req.protocol}://${req.get('host') ?? ''}`;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = getRequestId(req);
  const baseUrl = getBaseUrl(req);

  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      type: errorTypeUrl(err.code, baseUrl),
      code: err.code,
      message: err.message,
    };
    if (requestId) body.requestId = requestId;
    if (err instanceof ValidationError && err.details) body.details = err.details;

    res.status(err.statusCode).json(body);
    logger.warn({ err, requestId, code: err.code }, err.message);
    return;
  }

  if (isJsonSyntaxError(err)) {
    const body: Record<string, unknown> = {
      type: errorTypeUrl(ERROR_CODES.VALIDATION_ERROR, baseUrl),
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Invalid JSON in request body',
    };
    if (requestId) body.requestId = requestId;
    res.status(400).json(body);
    logger.warn({ err, requestId, code: ERROR_CODES.VALIDATION_ERROR }, 'Invalid JSON');
    return;
  }

  if (isBodyParserClientError(err)) {
    const status = (err as { status?: number }).status ?? (err as { statusCode?: number }).statusCode;
    const type = (err as { type?: string }).type;
    const message =
      status === 413
        ? 'Request body too large'
        : type === 'request.size.invalid'
          ? 'Request size did not match Content-Length'
          : 'Request aborted';
    const body: Record<string, unknown> = {
      type: errorTypeUrl(ERROR_CODES.VALIDATION_ERROR, baseUrl),
      code: ERROR_CODES.VALIDATION_ERROR,
      message,
    };
    if (requestId) body.requestId = requestId;
    res.status(status ?? 400).json(body);
    logger.warn({ err, requestId, code: ERROR_CODES.VALIDATION_ERROR }, message);
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');
  res.status(500).json({
    type: errorTypeUrl('INTERNAL_ERROR', baseUrl),
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    ...(requestId && { requestId }),
  });
}
