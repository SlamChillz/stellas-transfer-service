/**
 * Domain errors for transfer rules. Used by error middleware to map to HTTP status and body.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_NOT_ACTIVE: 'ACCOUNT_NOT_ACTIVE',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  SAME_ACCOUNT: 'SAME_ACCOUNT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const;

/** Short descriptions for /docs. Used in dev so error response type links resolve. */
export const ERROR_DESCRIPTIONS: Record<string, string> = {
  VALIDATION_ERROR: 'Request body or parameters failed validation (e.g. invalid UUID, missing required field).',
  ACCOUNT_NOT_FOUND: 'The specified account ID does not exist.',
  ACCOUNT_NOT_ACTIVE: 'The account is not in ACTIVE status (e.g. FROZEN or CLOSED).',
  CURRENCY_MISMATCH: 'Source and destination account currencies do not match the transfer currency.',
  INSUFFICIENT_BALANCE: 'The source account does not have enough available balance for the transfer.',
  SAME_ACCOUNT: 'Source and destination account IDs are the same; transfers must be between different accounts.',
  IDEMPOTENCY_CONFLICT: 'The same idempotency key (reference) was used with a different request body (amount, accounts, or currency). Use a unique reference per transfer or send the same body for retries.',
  INTERNAL_ERROR: 'An unexpected server error occurred. Check logs and requestId for details.',
  NOT_FOUND: 'The requested resource or endpoint was not found.',
};

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly details?: unknown) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AccountNotFoundError extends AppError {
  constructor(accountId: string) {
    super(ERROR_CODES.ACCOUNT_NOT_FOUND, `Account not found: ${accountId}`, 404);
    this.name = 'AccountNotFoundError';
    Object.setPrototypeOf(this, AccountNotFoundError.prototype);
  }
}

export class AccountNotActiveError extends AppError {
  constructor(accountId: string, status: string) {
    super(
      ERROR_CODES.ACCOUNT_NOT_ACTIVE,
      `Account ${accountId} is not active (status: ${status})`,
      422
    );
    this.name = 'AccountNotActiveError';
    Object.setPrototypeOf(this, AccountNotActiveError.prototype);
  }
}

export class CurrencyMismatchError extends AppError {
  constructor() {
    super(ERROR_CODES.CURRENCY_MISMATCH, 'Source and destination currencies do not match', 422);
    this.name = 'CurrencyMismatchError';
    Object.setPrototypeOf(this, CurrencyMismatchError.prototype);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor() {
    super(ERROR_CODES.INSUFFICIENT_BALANCE, 'Insufficient available balance', 422);
    this.name = 'InsufficientBalanceError';
    Object.setPrototypeOf(this, InsufficientBalanceError.prototype);
  }
}

export class SameAccountError extends AppError {
  constructor() {
    super(ERROR_CODES.SAME_ACCOUNT, 'Source and destination accounts must be different', 422);
    this.name = 'SameAccountError';
    Object.setPrototypeOf(this, SameAccountError.prototype);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor() {
    super(
      ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'This reference was already used for a transfer with different amount, accounts, or currency',
      409
    );
    this.name = 'IdempotencyConflictError';
    Object.setPrototypeOf(this, IdempotencyConflictError.prototype);
  }
}

export class TransferNotFoundError extends AppError {
  constructor(identifier: string) {
    super(ERROR_CODES.NOT_FOUND, `Transfer not found: ${identifier}`, 404);
    this.name = 'TransferNotFoundError';
    Object.setPrototypeOf(this, TransferNotFoundError.prototype);
  }
}
