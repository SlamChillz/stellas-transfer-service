import { Request, Response, NextFunction } from 'express';
import { createAccountSchema, topUpBalanceSchema } from '../types/testHelpers';
import { ValidationError } from '../types/errors';

export function validateCreateAccountBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join('; ') || 'Validation failed';
    throw new ValidationError(message, { fields: parsed.error.flatten().fieldErrors });
  }
  req.body = parsed.data;
  next();
}

export function validateTopUpBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const parsed = topUpBalanceSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join('; ') || 'Validation failed';
    throw new ValidationError(message, { fields: parsed.error.flatten().fieldErrors });
  }
  req.body = parsed.data;
  next();
}
