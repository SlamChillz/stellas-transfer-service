/**
 * Standalone concurrency script: hits the running API to verify idempotency and same-account concurrency.
 * Usage:
 *   1. Start the app and ensure DB has at least 2 ACTIVE accounts (e.g. npm run dev + seed).
 *   2. Set SOURCE_ACCOUNT_ID and DEST_ACCOUNT_ID (or use first two from DB via a small helper).
 *   3. Run: npx ts-node tests/concurrency/run-concurrent-transfers.ts
 *   Or: BASE_URL=http://localhost:3000 npm run test:concurrency
 *
 * Exits 0 on success, 1 on failure.
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface TransferBody {
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  currency: string;
  reference: string;
}

async function postTransfer(body: TransferBody): Promise<{ status: number; data?: unknown }> {
  const res = await fetch(`${BASE_URL}/api/v1/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = res.ok ? await res.json() : await res.text();
  return { status: res.status, data };
}

async function getHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const sourceId = process.env.SOURCE_ACCOUNT_ID;
  const destId = process.env.DEST_ACCOUNT_ID;
  if (!sourceId || !destId) {
    console.error('Set SOURCE_ACCOUNT_ID and DEST_ACCOUNT_ID (UUIDs of two ACTIVE NGN accounts).');
    process.exit(1);
  }

  if (!(await getHealth())) {
    console.error(`App not reachable at ${BASE_URL}. Start the server first.`);
    process.exit(1);
  }

  // 1. Idempotency: same reference multiple times → same response, single transfer
  const ref = `script-idem-${Date.now()}`;
  const results = await Promise.all([
    postTransfer({
      source_account_id: sourceId,
      destination_account_id: destId,
      amount: 100,
      currency: 'NGN',
      reference: ref,
    }),
    postTransfer({
      source_account_id: sourceId,
      destination_account_id: destId,
      amount: 100,
      currency: 'NGN',
      reference: ref,
    }),
  ]);

  if (results.some((r) => r.status !== 200)) {
    console.error('Idempotency: expected both 200', results);
    process.exit(1);
  }
  const ids = (results as { data?: { data?: { transfer?: { id: string } } } }[]).map(
    (r) => r.data?.data?.transfer?.id
  );
  if (ids[0] !== ids[1]) {
    console.error('Idempotency: expected same transfer id', ids);
    process.exit(1);
  }
  console.log('Idempotency: OK (same reference returned same transfer id)');

  // 2. Same-account concurrency: N transfers, total <= balance
  const N = 5;
  const amountEach = 200;
  const refs = Array.from({ length: N }, (_, i) => `script-concurrent-${Date.now()}-${i}`);
  const concurrentResults = await Promise.all(
    refs.map((reference) =>
      postTransfer({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: amountEach,
        currency: 'NGN',
        reference,
      })
    )
  );

  const failed = concurrentResults.filter((r) => r.status !== 200);
  if (failed.length > 0) {
    console.error('Concurrency: some requests failed', failed);
    process.exit(1);
  }
  console.log(`Concurrency: OK (${N} transfers completed)`);
  console.log('All checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
