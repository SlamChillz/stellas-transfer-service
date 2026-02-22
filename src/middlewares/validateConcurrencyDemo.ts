import { Request, Response, NextFunction } from 'express';
import { concurrentTransfersDemoSchema } from '../types/concurrencyDemo';
import { ValidationError } from '../types/errors';

export function validateConcurrencyDemoBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const parsed = concurrentTransfersDemoSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join('; ') || 'Validation failed';
    throw new ValidationError(message, { fields: parsed.error.flatten().fieldErrors });
  }
  req.body = parsed.data;
  next();
}
