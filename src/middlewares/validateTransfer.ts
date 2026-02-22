import { Request, Response, NextFunction } from 'express';
import { createTransferSchema } from '../types/transfer';
import { ValidationError } from '../types/errors';

export function validateTransferBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const parsed = createTransferSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const message = parsed.error.errors.map((e) => e.message).join('; ') || 'Validation failed';
    throw new ValidationError(message, {
      fields: issues.fieldErrors,
    });
  }
  req.body = parsed.data;
  next();
}
