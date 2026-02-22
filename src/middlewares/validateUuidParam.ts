import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../types/errors';

const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Validates that req.params[paramName] is a valid UUID. Use for routes like /accounts/:id, /transfers/:id.
 * Throws ValidationError (400) when the param is missing or not a valid UUID, so the client gets a proper 4xx response
 * instead of a 500 from the database.
 */
export function validateUuidParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const parsed = uuidSchema.safeParse(value);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join('; ') || 'Invalid UUID format';
      throw new ValidationError(message, { param: paramName, value });
    }
    next();
  };
}
