import { Request, Response } from 'express';
import type { CreateTransferInput } from '../types/transfer';

export function createTransferController(executeTransfer: (input: CreateTransferInput) => Promise<{
  id: string;
  reference: string;
  amount: number;
  currency: string;
  sourceAccountId: string;
  destinationAccountId: string;
  status: string;
  createdAt: Date;
}>) {
  return async function postTransfer(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateTransferInput;
    const transfer = await executeTransfer(input);
    res.status(200).json({
      data: {
        transfer: {
          id: transfer.id,
          reference: transfer.reference,
          amount: transfer.amount,
          currency: transfer.currency,
          sourceAccountId: transfer.sourceAccountId,
          destinationAccountId: transfer.destinationAccountId,
          status: transfer.status,
          createdAt: transfer.createdAt,
        },
      },
    });
  };
}
