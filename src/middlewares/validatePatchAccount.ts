import { Request, Response, NextFunction } from 'express';
import { patchAccountSchema } from '../types/account';
import { ValidationError } from '../types/errors';

export function validatePatchAccountBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const parsed = patchAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join('; ') || 'Validation failed';
    throw new ValidationError(message, { fields: parsed.error.flatten().fieldErrors });
  }
  req.body = parsed.data;
  next();
}
