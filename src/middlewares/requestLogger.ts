import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger as rootLogger } from '../utils/logger';

const REQUEST_ID_HEADER = 'x-request-id';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const log = rootLogger.child({ requestId, method: req.method, path: req.path });
  const start = Date.now();

  res.on('finish', () => {
    log.info(
      { statusCode: res.statusCode, responseTime: Date.now() - start },
      'Request completed'
    );
  });

  next();
}
