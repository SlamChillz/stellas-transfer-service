import { Request, Response } from 'express';
import type { AccountRepository } from '../repositories/AccountRepository';
import type { ConcurrentTransfersDemoInput } from '../types/concurrencyDemo';
import type {
  ConcurrentTransfersDemoResponse,
  PerTransferResult,
  TransferDirection,
} from '../types/concurrencyDemo';
import type { CreateTransferInput, TransferResult } from '../types/transfer';
import { AppError, AccountNotFoundError } from '../types/errors';

type ExecuteTransfer = (input: CreateTransferInput) => Promise<TransferResult>;

export function createConcurrencyDemoController(
  executeTransfer: ExecuteTransfer,
  accountRepository: AccountRepository
) {
  return async function postConcurrentTransfersDemo(
    req: Request,
    res: Response
  ): Promise<void> {
    const input = req.body as ConcurrentTransfersDemoInput;
    const {
      source_account_id,
      destination_account_id,
      currency,
      source_to_dest,
      dest_to_source,
    } = input;

    const start = Date.now();

    // Balances before
    const [sourceBefore, destBefore] = await Promise.all([
      accountRepository.findById(source_account_id),
      accountRepository.findById(destination_account_id),
    ]);

    if (!sourceBefore || !destBefore) {
      const missingId = sourceBefore ? destination_account_id : source_account_id;
      throw new AccountNotFoundError(missingId);
    }

    const sourceBalanceBefore = Number(sourceBefore.available_balance);
    const destBalanceBefore = Number(destBefore.available_balance);

    const baseRef = `demo-${Date.now()}`;
    const a2bInputs: { input: CreateTransferInput; direction: TransferDirection }[] = [];
    const b2aInputs: { input: CreateTransferInput; direction: TransferDirection }[] = [];

    for (let i = 0; i < source_to_dest.count; i++) {
      a2bInputs.push({
        direction: 'source_to_destination',
        input: {
          source_account_id,
          destination_account_id,
          amount: source_to_dest.amount_per_transfer,
          currency,
          reference: `${baseRef}-a2b-${i}`,
        },
      });
    }
    for (let i = 0; i < dest_to_source.count; i++) {
      b2aInputs.push({
        direction: 'destination_to_source',
        input: {
          source_account_id: destination_account_id,
          destination_account_id: source_account_id,
          amount: dest_to_source.amount_per_transfer,
          currency,
          reference: `${baseRef}-b2a-${i}`,
        },
      });
    }

    const allTasks = [...a2bInputs, ...b2aInputs];

    const results: PerTransferResult[] = await Promise.all(
      allTasks.map(async ({ input: transferInput, direction }): Promise<PerTransferResult> => {
        try {
          const result = await executeTransfer(transferInput);
          return {
            reference: result.reference,
            direction,
            amount: result.amount,
            status: 'completed',
            transfer_id: result.id,
          };
        } catch (err) {
          const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
          const message = err instanceof Error ? err.message : String(err);
          return {
            reference: transferInput.reference,
            direction,
            amount: transferInput.amount,
            status: 'failed',
            error_code: code,
            error_message: message,
          };
        }
      })
    );

    const durationMs = Date.now() - start;

    // Balances after
    const [sourceAfter, destAfter] = await Promise.all([
      accountRepository.findById(source_account_id),
      accountRepository.findById(destination_account_id),
    ]);
    const sourceBalanceAfter = sourceAfter ? Number(sourceAfter.available_balance) : sourceBalanceBefore;
    const destBalanceAfter = destAfter ? Number(destAfter.available_balance) : destBalanceBefore;

    const a2bResults = results.filter((r) => r.direction === 'source_to_destination');
    const b2aResults = results.filter((r) => r.direction === 'destination_to_source');

    const summary: ConcurrentTransfersDemoResponse['summary'] = {
      duration_ms: durationMs,
      source_account_id,
      destination_account_id,
      source_balance_before: sourceBalanceBefore,
      source_balance_after: sourceBalanceAfter,
      destination_balance_before: destBalanceBefore,
      destination_balance_after: destBalanceAfter,
      source_to_dest: {
        requested: source_to_dest.count,
        succeeded: a2bResults.filter((r) => r.status === 'completed').length,
        failed: a2bResults.filter((r) => r.status === 'failed').length,
      },
      dest_to_source: {
        requested: dest_to_source.count,
        succeeded: b2aResults.filter((r) => r.status === 'completed').length,
        failed: b2aResults.filter((r) => r.status === 'failed').length,
      },
    };

    const response: ConcurrentTransfersDemoResponse = {
      scenario: 'concurrent_transfers_bidirectional',
      summary,
      transfers: results,
    };

    res.status(200).json({ data: response });
  };
}
