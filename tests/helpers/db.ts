import { sequelize, Account, Transfer, LedgerEntry } from '../../src/models';

const TRUNCATE_SQL =
  'TRUNCATE TABLE audit_logs, ledger_entries, transfers, accounts RESTART IDENTITY CASCADE';

export async function truncateAll(): Promise<void> {
  const maxAttempts = 3;
  const delayMs = 200;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sequelize.query(TRUNCATE_SQL);
      return;
    } catch (err) {
      const e = err as { code?: string; parent?: { code?: string }; message?: string } | null;
      const isLockOrTimeout =
        err &&
        typeof err === 'object' &&
        (e?.code === '40P01' ||
          e?.parent?.code === '40P01' ||
          e?.message?.includes('lock') === true ||
          e?.message?.includes('timeout') === true);
      if (isLockOrTimeout && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
}

export async function createTwoAccounts(): Promise<{ sourceId: string; destId: string }> {
  const [source, dest] = await Account.bulkCreate([
    {
      business_id: 'biz-int-1',
      currency: 'NGN',
      available_balance: '100000',
      ledger_balance: '100000',
      status: 'ACTIVE',
    },
    {
      business_id: 'biz-int-2',
      currency: 'NGN',
      available_balance: '50000',
      ledger_balance: '50000',
      status: 'ACTIVE',
    },
  ]);
  return { sourceId: source.id, destId: dest.id };
}

export async function getAccountBalance(accountId: string): Promise<{ available: number; ledger: number }> {
  const a = await Account.findByPk(accountId);
  if (!a) throw new Error('Account not found');
  return { available: Number(a.available_balance), ledger: Number(a.ledger_balance) };
}

export async function getTransferCount(): Promise<number> {
  return Transfer.count();
}

export async function getLedgerEntryCount(): Promise<number> {
  return LedgerEntry.count();
}

/**
 * Recomputes ledger balance for an account from ledger_entries (sum of CREDITs − sum of DEBITs).
 * Used to assert the invariant: account.ledger_balance === reconstructed balance from ledger.
 */
export async function getLedgerBalanceForAccount(accountId: string): Promise<number> {
  const entries = await LedgerEntry.findAll({ where: { account_id: accountId } });
  let balance = 0;
  for (const e of entries) {
    const amount = Number(e.amount);
    balance += e.type === 'CREDIT' ? amount : -amount;
  }
  return balance;
}

export async function closeDb(): Promise<void> {
  await sequelize.close();
}
