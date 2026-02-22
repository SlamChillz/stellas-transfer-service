import { Request, Response } from 'express';
import type { Transfer } from '../models';
import { TransferNotFoundError, ValidationError } from '../types/errors';

function transferToResponse(t: Transfer) {
  return {
    id: t.id,
    reference: t.reference,
    amount: Number(t.amount),
    currency: t.currency,
    sourceAccountId: t.source_account_id,
    destinationAccountId: t.destination_account_id,
    status: t.status,
    createdAt: t.created_at,
  };
}

export function createGetTransferByIdController(
  findById: (id: string) => Promise<Transfer | null>
) {
  return async function getTransferById(req: Request, res: Response): Promise<void> {
    const transfer = await findById(req.params.id);
    if (!transfer) throw new TransferNotFoundError(req.params.id);
    res.status(200).json({
      data: { transfer: transferToResponse(transfer) },
    });
  };
}

export function createGetTransferByReferenceController(
  findByReference: (reference: string) => Promise<Transfer | null>
) {
  return async function getTransferByReference(req: Request, res: Response): Promise<void> {
    const reference = String(req.query.reference ?? '').trim();
    if (!reference) throw new ValidationError('Query parameter "reference" is required');
    const transfer = await findByReference(reference);
    if (!transfer) throw new TransferNotFoundError(reference);
    res.status(200).json({
      data: { transfer: transferToResponse(transfer) },
    });
  };
}
