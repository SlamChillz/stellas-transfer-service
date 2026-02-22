/**
 * Concurrency test: many simultaneous transfers from the same source account.
 * Asserts final balance and ledger consistency (no lost updates).
 * Requires test DB with migrations run.
 */
import request from 'supertest';
import { app } from '../../src/app';
import {
  truncateAll,
  createTwoAccounts,
  getAccountBalance,
  getTransferCount,
  getLedgerEntryCount,
  closeDb,
} from '../helpers/db';
import { LedgerEntry } from '../../src/models';

describe('Concurrency: multiple transfers from same source', () => {
  const CONCURRENT_COUNT = 10;
  const AMOUNT_PER_TRANSFER = 1000;

  let sourceId: string;
  let destId: string;

  beforeAll(async () => {
    await truncateAll();
    const ids = await createTwoAccounts();
    sourceId = ids.sourceId;
    destId = ids.destId;
  });

  afterAll(async () => {
    await closeDb();
  });

  it('applies all concurrent transfers correctly (no lost updates)', async () => {
    const totalDebit = CONCURRENT_COUNT * AMOUNT_PER_TRANSFER;
    const initialSource = await getAccountBalance(sourceId);
    expect(initialSource.available).toBeGreaterThanOrEqual(totalDebit);

    const refs = Array.from({ length: CONCURRENT_COUNT }, (_, i) => `ref-concurrent-${i}`);
    const results = await Promise.all(
      refs.map((reference) =>
        request(app)
          .post('/api/v1/transfers')
          .send({
            source_account_id: sourceId,
            destination_account_id: destId,
            amount: AMOUNT_PER_TRANSFER,
            currency: 'NGN',
            reference,
          })
      )
    );

    const ok = results.filter((r) => r.status === 200);
    const failed = results.filter((r) => r.status !== 200);
    if (failed.length > 0) {
      throw new Error(`Some requests failed: ${failed.map((f) => `${f.status} ${JSON.stringify(f.body)}`).join('; ')}`);
    }
    expect(ok.length).toBe(CONCURRENT_COUNT);

    const sourceBal = await getAccountBalance(sourceId);
    const destBal = await getAccountBalance(destId);
    expect(sourceBal.available).toBe(initialSource.available - totalDebit);
    expect(sourceBal.ledger).toBe(initialSource.ledger - totalDebit);
    expect(destBal.available).toBe(50000 + totalDebit);
    expect(destBal.ledger).toBe(50000 + totalDebit);

    const transferCount = await getTransferCount();
    const ledgerCount = await getLedgerEntryCount();
    expect(transferCount).toBe(CONCURRENT_COUNT);
    expect(ledgerCount).toBe(CONCURRENT_COUNT * 2);

    const entries = await LedgerEntry.findAll();
    const debits = entries.filter((e) => e.type === 'DEBIT');
    const credits = entries.filter((e) => e.type === 'CREDIT');
    const sumDebits = debits.reduce((s, e) => s + Number(e.amount), 0);
    const sumCredits = credits.reduce((s, e) => s + Number(e.amount), 0);
    expect(sumDebits).toBe(totalDebit);
    expect(sumCredits).toBe(totalDebit);
  }, 30000);
});
