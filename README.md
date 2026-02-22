# Stellas Internal Transfer Service

A small internal transfer service for business banking. It moves money between accounts, keeps a double-entry ledger, and handles retries safely (idempotency) and concurrent requests without corrupting balances.

**Recommended for reviewers:** Docker and Docker Compose (v2). You can run the app and all tests without installing Node.js or Postgres. (For local development you can use Node.js 22 and PostgreSQL 14+.) The app is written in TypeScript and uses Express, Sequelize, and Zod.

**API docs:** [Stellas Internal Transfer Service API](https://documenter.getpostman.com/view/43502486/2sBXcEkfqS) (Postman) — request reference and try-it-out in the browser. Local collection: `postman/Stellas-Transfer-API.postman_collection.json` (set `base_url`, `source_account_id` = `9816b2b9-8db7-44cc-abdc-172fde645d32`, `destination_account_id` = `8a6823d7-c652-4d67-8859-0e62ae5b8f52`).

---

## Table of contents

- [Quick start (Docker — recommended)](#quick-start-docker--recommended)
- [Running without Docker (local Node + Postgres)](#running-without-docker-local-node--postgres)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [Tests](#tests)
- [How the code is structured](#how-the-code-is-structured)
- [Transactions and locking](#transactions-and-locking)
- [Trade-offs and assumptions](#trade-offs-and-assumptions)
- [Design: transactional integrity, concurrency, idempotency, and ledger](#design-transactional-integrity-concurrency-idempotency-and-ledger)
  - [Transactional integrity](#transactional-integrity)
  - [Concurrency safety](#concurrency-safety)
  - [Idempotency design](#idempotency-design)
  - [Ledger correctness](#ledger-correctness)
- [API](#api)
  - [Health](#health)
  - [Create a transfer](#create-a-transfer)
  - [Get account](#get-account)
  - [Update account status](#update-account-status)
  - [Get transfer by ID](#get-transfer-by-id)
  - [Get transfer by reference](#get-transfer-by-reference)
  - [List transfers for account](#list-transfers-for-account)
  - [List ledger entries for account](#list-ledger-entries-for-account)
  - [Example requests (curl)](#example-requests-curl)
- [What's in this repo](#whats-in-this-repo)
- [Implementation overview](#implementation-overview)
  - [Functional requirements](#functional-requirements)
  - [Non-functional requirements](#non-functional-requirements)
  - [Testing requirements](#testing-requirements)
  - [Important constraints (all satisfied)](#important-constraints-all-satisfied)

---

## Quick start (Docker — recommended)

You only need Docker and Docker Compose. No need for `make` or a local Node/Postgres install.

**1. Copy env and start the app**

```bash
cp .env.example .env
docker compose --profile tools up -d --build
```

Compose starts Postgres 16, the app (Node 22), and Adminer. The app runs migrations on start and listens on **http://localhost:3000**. Check: `curl -s http://localhost:3000/health`.

Adminer (DB UI) is at **http://localhost:8080** — log in with System: PostgreSQL, Server: `db`, user/password from `.env` (default `postgres`/`postgres`).

**2. Demo accounts**

When the app starts in Docker it runs the seed by default (`RUN_SEED_ON_START=true`): two ACTIVE NGN accounts, each topped up with 100000:

- `9816b2b9-8db7-44cc-abdc-172fde645d32` (biz-001)
- `8a6823d7-c652-4d67-8859-0e62ae5b8f52` (biz-002)

You can try transfers between them right away. To re-seed manually (e.g. if you set `RUN_SEED_ON_START=false`): `docker compose exec app npx sequelize-cli db:seed:all`

**3. Run tests**

```bash
docker compose --profile test build test
docker compose --profile test run --rm test
```

**4. Stop**

```bash
docker compose down
```

Compose reads `.env`. Override: `PORT` (3000), `DB_PORT` (5432), `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `APP_VERSION`, `ADMINER_PORT` (8080). Data lives in a Docker volume; `docker compose down -v` wipes it. App version is in `/health` and `/version`; all routes are under `/api/v1/`.

---

## Running without Docker (local Node + Postgres)

If you prefer to run the app on your machine:

```bash
npm ci
cp .env.example .env
# Edit .env (DB_HOST=localhost, DB_PORT=5432, DB_PASSWORD=…)
npm run db:migrate
npm run db:seed
npm run dev
```

If you have `make`, run `make` to see shortcuts (e.g. `make install`, `make dev`, `make docker-test`).

---

## Demo accounts

The seeder creates two ACTIVE NGN accounts and credits each with **100000** (in the smallest unit; no decimal subunit). Use them for transfers, Postman, or the concurrency script.

| Account ID | Business ID | Currency | Initial balance | Status |
|------------|-------------|----------|------------------|--------|
| `9816b2b9-8db7-44cc-abdc-172fde645d32` | biz-001 | NGN | 100000 | ACTIVE |
| `8a6823d7-c652-4d67-8859-0e62ae5b8f52` | biz-002 | NGN | 100000 | ACTIVE |

- **When they’re created:** In Docker, the app runs the seed on start when `RUN_SEED_ON_START=true` (default). Locally, run `npm run db:seed` after migrations.
- **Re-seeding:** Running the seed again replaces these two accounts and resets their balances to 100000 each (any other data in the DB is unchanged).
- **Example:** To move 5000 from the first to the second account, use `source_account_id`: `9816b2b9-8db7-44cc-abdc-172fde645d32`, `destination_account_id`: `8a6823d7-c652-4d67-8859-0e62ae5b8f52`, `amount`: 5000, `currency`: `"NGN"`, and a unique `reference`.

---

## Environment variables

| Variable | What it does |
|----------|----------------|
| `NODE_ENV` | `development`, `test`, or `production`. |
| `PORT` | Port the server listens on (default 3000). |
| `LOG_LEVEL` | Pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `APP_VERSION` | App version (default `1.0.0`); shown in `/health` and `/version`. |
| `RUN_MIGRATIONS_ON_START` | If `true`, run DB migrations when the app starts (default `true`). |
| `RUN_SEED_ON_START` | If `true`, run DB seed when the app starts (default `false`; Docker uses `true`). |
| `ALLOW_TEST_ENDPOINTS` | If `true`, enable test-only endpoints (create account, top-up, concurrency demo). Default `true`; auto-disabled in production. |
| `DATABASE_URL` | Full Postgres URL. If set, the app uses it and ignores the `DB_*` vars below. |
| `DB_HOST` | Postgres host (default `localhost`; in Docker the app gets `db`). |
| `DB_PORT` | Postgres port (default 5432). |
| `DB_NAME` | Database name (default `stellas_transfer`). |
| `DB_USER` | Postgres user (default `postgres`). |
| `DB_PASSWORD` | Postgres password. No default; set it in `.env`. |
| `ADMINER_PORT` | Port for Adminer when using Docker `--profile tools` (default 8080). |

---

## Tests

**Recommended: run tests in Docker** (no local Node or Postgres needed):

```bash
docker compose --profile test build test
docker compose --profile test run --rm test
```

**Local npm test** (with Node installed): The npm test scripts start `docker compose --profile test` and wait for the DB if needed, then run Jest. So you can run:

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:watch
npm run test:coverage
```

**Concurrency script** (optional). With the app running, use the demo account IDs (see [Demo accounts](#demo-accounts)):

```bash
SOURCE_ACCOUNT_ID=9816b2b9-8db7-44cc-abdc-172fde645d32 DEST_ACCOUNT_ID=8a6823d7-c652-4d67-8859-0e62ae5b8f52 npm run test:concurrency
```

It sends duplicate references and concurrent transfers and checks that balances and idempotency behave correctly.

---

## How the code is structured

The app is split into clear layers so that HTTP, business rules, and database access stay separate.

- **Controllers** — Deal only with HTTP: read the request body, call the service, and send back JSON. They don’t touch the database or implement transfer rules.
- **Services** — Contain all transfer logic: validation, locking, double-entry, idempotency. They run inside a single database transaction per transfer.
- **Repositories** — Talk to the database (via Sequelize). No business logic; they just load and save accounts, transfers, ledger entries, and audit rows.

Validation is done with Zod in a middleware before the controller. Errors (e.g. insufficient balance, invalid body) are turned into a consistent JSON shape by a central error middleware and always include a `requestId` when available so you can trace a request in logs.

---

## Transactions and locking

Every transfer runs in **one** Sequelize transaction. If anything fails, the whole transfer is rolled back; balances are never partially updated.

To avoid two concurrent transfers from the same account corrupting the balance, the two accounts (source and destination) are locked with `SELECT FOR UPDATE` inside that transaction. Only one transfer can be updating a given account at a time; others wait. Locking is always done in the same order (by account ID) so two transfers that touch the same two accounts cannot deadlock.

The implementation uses Postgres’s default isolation (Read Committed) plus these row locks. That is sufficient for correct balance updates without the cost of serializable isolation.

For the goals, decisions, and reasons behind transactional integrity, concurrency safety, idempotency, and ledger correctness, see the section **Design: transactional integrity, concurrency, idempotency, and ledger** below.

---

## Trade-offs and assumptions

- **Idempotency** — The client sends a `reference` per transfer. It is stored and treated as unique. If the same reference is sent again (e.g. after a timeout and retry), the same transfer result is returned and no second transfer is created. References are not expired or managed beyond this; the client is responsible for choosing unique references.
- **Currency** — No currency conversion is performed. The source account, destination account, and request must all use the same currency (e.g. NGN). Mismatches are rejected.
- **Amounts** — Stored as numbers. A single convention is used (e.g. 10000 = 100.00 in the smallest unit). No fractional subunits in this service.
- **Audit** — Each successful transfer writes a row to an audit table (who, what, balances before/after) in the same transaction as the transfer. For very high throughput you could later move audit to an async path or event stream.
- **Single region** — No distributed locking or multi-region design; one Postgres, one app (or multiple app instances sharing that DB).

---

## Design: transactional integrity, concurrency, idempotency, and ledger

This section explains how the four core design areas were implemented: the **goal** of each, the **decisions** made, and the **reasons** behind them.

### Transactional integrity

**Goal** — No transfer should leave the system in a half-applied state. Either the full operation (debit source, credit destination, ledger entries, audit) is committed, or none of it is. Balances must never be updated without a corresponding ledger record, and a failure at any step must undo everything for that transfer.

**Decisions** — (1) One Sequelize transaction per transfer that wraps all reads and writes. (2) Balance updates, ledger inserts, and audit insert happen only inside that transaction. (3) On any error (validation, insufficient balance, or DB error), the transaction is rolled back before returning a response. (4) Read Committed isolation is used; correctness is achieved by the single-transaction boundary and row locking, not by a stricter isolation level.

**Reasons** — A single transaction gives atomicity: commit applies all changes, rollback applies none. Keeping balance updates and ledger/audit in the same transaction guarantees that balances and ledger always stay in sync. Read Committed was chosen so that only the two account rows involved are locked; serializable isolation would increase lock scope and the chance of aborts under concurrency, without adding safety that row-level locking does not already provide.

---

### Concurrency safety

**Goal** — When many requests run at once (e.g. several transfers debiting the same account, or two clients sending the same idempotency key), balances and ledger must remain correct. No lost updates, no double-spend, and no deadlocks between transfers that touch overlapping accounts.

**Decisions** — (1) Lock the source and destination account rows with `SELECT FOR UPDATE` inside the transfer transaction so that only one transfer at a time can change a given account’s balance. (2) Lock in a fixed order: sort the two account IDs and always acquire the lock on the smaller ID first, then the larger. (3) Rely on the database unique constraint on `reference` and on handling `UniqueConstraintError` to resolve duplicate references (see Idempotency below).

**Reasons** — Row-level locking serializes updates per account, so concurrent debits from the same account are applied one after another and the final balance is correct. Locking in a consistent order (e.g. always “smaller UUID first”) ensures that if transfer A locks account 1 then 2, and transfer B also touches 1 and 2, B will try to lock in the same order and will wait instead of deadlocking (e.g. A: 1→2, B: 2→1 would deadlock; with a fixed order both do 1→2). The unique constraint on `reference` is the single source of truth for idempotency under concurrency; handling the unique violation by loading and returning the existing transfer keeps the “same reference → same response” guarantee even when two requests race.

---

### Idempotency design

**Goal** — A client that retries after a timeout or network failure must get the same logical outcome as the first attempt: one transfer created, one response. Retrying with the same idempotency key must not create a second transfer or double-debit the source account.

**Decisions** — (1) The client supplies a `reference` string per logical transfer; the service treats it as the idempotency key. (2) A unique constraint on `transfers.reference` enforces at the database level that only one row per reference can exist. (3) Before starting the transfer (and before acquiring account locks), the service looks up an existing transfer by `reference`; if found, that transfer’s data is returned immediately with no new write. (4) If two requests with the same reference both pass the “existing?” check and one inserts first, the second hits the unique constraint; the code catches that, loads the transfer created by the first, and returns it so both clients receive the same result.

**Reasons** — Checking by reference before locking avoids unnecessary contention when the client is simply retrying. The unique constraint guarantees that even under concurrent requests with the same reference, only one row is ever created; the “loser” is turned into a successful return of the winner’s result. Relying on the DB for uniqueness avoids race conditions that a purely application-level “have we seen this reference?” check could have. If the same reference is later used with a different amount, accounts, or currency, the API returns 409 `IDEMPOTENCY_CONFLICT` to signal that the key was already used for a different operation.

---

### Ledger correctness

**Goal** — Every movement of value is recorded in an immutable, double-entry ledger. For each transfer, total debits equal total credits, and each account’s balance can be reconciled against its ledger history. The ledger is the audit trail for what happened, not just a copy of the current balance.

**Decisions** — (1) Each successful transfer creates exactly two ledger rows: one DEBIT (source account) and one CREDIT (destination account), both with the same `transfer_id` and the same `amount`. (2) Account balances (`available_balance` and `ledger_balance`) are updated in the same transaction as the ledger inserts so that balances and ledger never diverge. (3) Ledger rows are append-only: no update or delete is ever issued against `ledger_entries`. (4) Optional `balance_after` on each entry records the account balance after that entry, so a reader can verify or reconstruct state from the ledger alone.

**Reasons** — Double-entry (every debit has a matching credit, same amount, same transfer) keeps the ledger consistent and supports reconciliation. One DEBIT and one CREDIT per transfer with a shared `transfer_id` makes it easy to query “all entries for this transfer” and to enforce the invariant that sum of debits = sum of credits per transfer. Append-only keeps the ledger tamper-evident and simplifies reasoning about history. Writing ledger and balance changes in the same transaction ensures that if the transfer commits, both the balances and the ledger reflect it; if the transaction rolls back, neither does. Maintaining both `available_balance` on accounts and a full ledger avoids “balance-only” implementations and meets the requirement that the ledger is the source of truth for what happened.

---

## API

### Health

```bash
curl -s http://localhost:3000/health
```

Response includes `status`, `version`, and `apiVersion`. Useful for load balancers and “is it up?” checks.

---

### Create a transfer

**POST** `/api/v1/transfers`

Body (JSON):

| Field | Type | Description |
|-------|------|-------------|
| `source_account_id` | UUID | Account to debit. |
| `destination_account_id` | UUID | Account to credit. |
| `amount` | number | Positive amount (e.g. 10000 for 100.00 in smallest unit). |
| `currency` | string | Must match both accounts (e.g. `"NGN"`). |
| `reference` | string | Your idempotency key. One logical transfer = one reference; reuse it on retries to get the same result. |

**Success (200)** — You get something like:

```json
{
  "data": {
    "transfer": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "reference": "my-unique-ref-001",
      "amount": 10000,
      "currency": "NGN",
      "sourceAccountId": "...",
      "destinationAccountId": "...",
      "status": "COMPLETED",
      "createdAt": "2025-02-20T12:00:00.000Z"
    }
  }
}
```

**Errors** — Responses use a stable shape: `type`, `code`, `message`, and optionally `requestId` and `details`. Use `code` in your client. Possible codes:

- `VALIDATION_ERROR` (400) — Invalid UUIDs, negative amount, missing fields, etc. `details.fields` may list per-field errors.
- `ACCOUNT_NOT_FOUND` (404) — One of the account IDs doesn’t exist.
- `ACCOUNT_NOT_ACTIVE` (422) — Source or destination is FROZEN or CLOSED.
- `CURRENCY_MISMATCH` (422) — Request currency doesn’t match one or both accounts.
- `INSUFFICIENT_BALANCE` (422) — Source doesn’t have enough available balance.
- `SAME_ACCOUNT` (422) — Source and destination are the same account.
- `IDEMPOTENCY_CONFLICT` (409) — The same `reference` was already used for a different transfer (different amount, accounts, or currency). Use a new reference for each new transfer, or send the exact same body again if you’re retrying.

---

### Get account

**GET** `/api/v1/accounts/:id`

Returns one account by ID. Response: `{ "data": { "account": { "id", "business_id", "currency", "available_balance", "ledger_balance", "status", "created_at", "updated_at" } } }`. **404** if the account does not exist (`ACCOUNT_NOT_FOUND` or `NOT_FOUND`).

---

### Update account status

**PATCH** `/api/v1/accounts/:id`

Body (JSON): `{ "status": "ACTIVE" | "FROZEN" | "CLOSED" }`. Returns the updated account in the same shape as GET account. **404** if account not found; **400** for invalid body (e.g. invalid or missing `status`).

---

### Get transfer by ID

**GET** `/api/v1/transfers/:id`

Returns one transfer by ID in the same shape as the create response (`data.transfer`). **404** if not found (`NOT_FOUND`).

---

### Get transfer by reference

**GET** `/api/v1/transfers?reference=<reference>`

Query parameter `reference` is required. Returns one transfer in the same shape as create. **400** if `reference` is missing; **404** if no transfer has that reference.

---

### List transfers for account

**GET** `/api/v1/accounts/:id/transfers`

Lists transfers where the account is source or destination. Query: `limit` (default 20, max 100), `offset` (default 0). Response: `{ "data": { "transfers": [ ... ] }, "meta": { "total", "limit", "offset" } }`. **404** if the account does not exist.

---

### List ledger entries for account

**GET** `/api/v1/accounts/:id/ledger-entries`

Lists ledger entries for the account. Query: `limit` (default 20, max 100), `offset` (default 0). Response: `{ "data": { "ledgerEntries": [ { "id", "transfer_id", "account_id", "type", "amount", "balance_after", "created_at" } ] }, "meta": { "total", "limit", "offset" } }`. **404** if the account does not exist.

---

### Example requests (curl)

The demo accounts (see [Demo accounts](#demo-accounts)) can be used as source and destination. Source: `9816b2b9-8db7-44cc-abdc-172fde645d32`, destination: `8a6823d7-c652-4d67-8859-0e62ae5b8f52`.

**Successful transfer**

```bash
curl -s -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "source_account_id": "9816b2b9-8db7-44cc-abdc-172fde645d32",
    "destination_account_id": "8a6823d7-c652-4d67-8859-0e62ae5b8f52",
    "amount": 10000,
    "currency": "NGN",
    "reference": "my-unique-ref-001"
  }'
```

**Idempotency** — Send the same body twice. The second response has the same `data.transfer.id` and no duplicate transfer is created:

```bash
curl -s -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{"source_account_id":"9816b2b9-8db7-44cc-abdc-172fde645d32","destination_account_id":"8a6823d7-c652-4d67-8859-0e62ae5b8f52","amount":100,"currency":"NGN","reference":"idem-ref"}'
# Run the same line again; you get the same transfer id.
```

**Insufficient balance** — Use an amount larger than the source’s balance (100000); you get 422 and `INSUFFICIENT_BALANCE`:

```bash
curl -s -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{"source_account_id":"9816b2b9-8db7-44cc-abdc-172fde645d32","destination_account_id":"8a6823d7-c652-4d67-8859-0e62ae5b8f52","amount":99999999,"currency":"NGN","reference":"ref-big"}'
```

**Validation error** — e.g. invalid UUID; you get 400 and `VALIDATION_ERROR`:

```bash
curl -s -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{"source_account_id":"not-a-uuid","destination_account_id":"8a6823d7-c652-4d67-8859-0e62ae5b8f52","amount":100,"currency":"NGN","reference":"ref"}'
```

**Currency mismatch** — Demo accounts are NGN; send `"currency":"USD"` and you get 422 and `CURRENCY_MISMATCH`:

```bash
curl -s -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{"source_account_id":"9816b2b9-8db7-44cc-abdc-172fde645d32","destination_account_id":"8a6823d7-c652-4d67-8859-0e62ae5b8f52","amount":100,"currency":"USD","reference":"ref-currency"}'
```

---


## What’s in this repo

| What | Where |
|------|--------|
| Quick commands (optional) | [Makefile](Makefile) — run `make` for install, dev, test, lint, docker shortcuts; reviewers can use `docker compose` CLI instead |
| Setup and config | This README and [.env.example](.env.example) |
| Architecture and locking | Sections above in this README |
| Trade-offs | “Trade-offs and assumptions” above |
| Database migrations | `database/migrations/` |
| Seed data | `database/seeders/`; run with `npm run db:seed` |
| API examples | cURL above and [postman/](postman/) |
| Unit tests | `tests/unit/` — `npm run test:unit` (npm test scripts bring up Docker test stack if needed) |
| Integration tests | `tests/integration/` — `npm run test:integration` |
| Concurrency check | `tests/concurrency/run-concurrent-transfers.ts` — `npm run test:concurrency` (app must be running) |

**Concurrency demo (test-only)** — When test endpoints are allowed (`ALLOW_TEST_ENDPOINTS=true` or non-production), **POST** `/api/v1/demo/concurrent-transfers` runs many transfers in parallel (source→dest and dest→source) and returns a report: balances before/after, success/fail counts, and per-transfer results. Useful to see locking and double-entry under load. Request body: `source_account_id`, `destination_account_id`, `currency`, `source_to_dest: { count, amount_per_transfer }`, `dest_to_source: { count, amount_per_transfer }`. See the route and controller in the code for the exact schema.

---

## Implementation overview

This section maps the service's functional and non-functional requirements to what is implemented.

### Functional requirements

**3.1 Account model** — Each account has: `id` (UUID), `business_id`, `currency`, `available_balance`, `ledger_balance`, `status` (ACTIVE | FROZEN | CLOSED), `created_at`, `updated_at`. Implemented in the `accounts` migration and the `Account` Sequelize model in `src/models/Account.ts`.

**3.2 Transfer endpoint** — **POST** `/api/v1/transfers` with body `source_account_id`, `destination_account_id`, `amount`, `currency`, `reference`. Implemented in `src/routes/v1.ts`, `src/controllers/transferController.ts`, and `src/services/TransferService.ts`. Request body is validated with Zod in `src/middlewares/validateTransfer.ts`; types live in `src/types/transfer.ts`.

**3.3 Transfer rules** — Transfers from or to FROZEN/CLOSED accounts are rejected (422, `ACCOUNT_NOT_ACTIVE`). Currency mismatches are rejected (422, `CURRENCY_MISMATCH`). Insufficient available balance is rejected (422, `INSUFFICIENT_BALANCE`). Same source and destination is rejected (422, `SAME_ACCOUNT`). Every transfer runs inside a single Sequelize transaction (`src/services/TransferService.ts`). Double-entry is implemented by creating one DEBIT and one CREDIT ledger entry per transfer and updating both accounts’ `available_balance` and `ledger_balance` in the same transaction. Idempotency is enforced via the `reference` field (see 3.5). Race conditions are prevented by locking source and destination account rows with `SELECT FOR UPDATE` and by locking in a consistent order (sorted account IDs) to avoid deadlocks.

**3.4 Ledger requirements** — A `ledger_entries` table (migration and model) exists with `transfer_id`, `account_id`, `type` (DEBIT | CREDIT), `amount`, optional `balance_after`, and `created_at`. Each successful transfer creates exactly one DEBIT (source) and one CREDIT (destination), both linked by the same `transfer_id`. Ledger rows are append-only: only inserts are performed; no update or delete.

**3.5 Idempotency** — The `transfers` table has a unique constraint on `reference`. Before acquiring locks, the service checks for an existing transfer with that reference; if found, its data is returned (same response as the first request). If two requests with the same reference run at once, one creates the row and the other hits the unique constraint; that case is caught, the existing transfer is loaded, and returned. The same reference always yields the same response and no duplicate transfers or ledger entries. Implemented in `TransferService.executeTransfer` and in the transfer repository.

### Non-functional requirements

**4.1 Architecture** — A layered structure is used: `src/controllers`, `src/services`, `src/repositories`, `src/models`, `src/middlewares`, plus `src/config`, `src/routes`, `src/types`, `src/utils`. Business logic lives only in services; controllers only handle HTTP (parse body, call service, format response). No database or transfer rules in controllers. See “How the code is structured” above.

**4.2 Database & transactions** — All balance updates occur inside an explicit Sequelize transaction in `TransferService.executeTransfer`. The locking strategy is `SELECT FOR UPDATE` on the source and destination account rows (via `AccountRepository.findByIdForUpdate`), with locking in a fixed order (sorted account IDs) to prevent deadlocks. The decision and flow are explained in the “Transactions and locking” section above.

**4.3 Concurrency handling** — Correctness under concurrent debits and duplicate references is ensured by: (1) row-level locks so only one transfer updates an account at a time, (2) unique constraint on `reference` plus handling of unique violations so duplicate references return the original result. The project includes a Jest concurrency test (`tests/integration/concurrency.test.ts`) that runs many concurrent transfers from the same source and asserts final balances and ledger consistency, and a standalone script `tests/concurrency/run-concurrent-transfers.ts` (run with `npm run test:concurrency`) that hits the running API with duplicate references and concurrent same-account transfers. An optional test-only endpoint **POST** `/api/v1/demo/concurrent-transfers` can also be used to simulate concurrent load.

**4.4 Logging & audit trail** — Pino is used for structured logging (JSON in production, pretty in development), with a request middleware that adds a request ID and logs method, path, status code, and response time. The business audit log is the `audit_logs` table: each successful transfer inserts one row with initiating user (mock ID when not provided), transfer reference, source/destination account IDs, amount, currency, balances before and after for both accounts, and timestamp. The audit row is written inside the same Sequelize transaction as the transfer so it commits or rolls back with the transfer.

### Testing requirements

- **Unit tests for transfer logic** — `tests/unit/TransferService.test.ts`: repositories are mocked; the tests cover rejection of FROZEN/CLOSED accounts, wrong currency, insufficient balance, same account, missing account; idempotency (same reference returns same result without creating again); and the success path (transfer created, balances updated, ledger entries and audit created). Run with `npm run test:unit`.
- **Idempotency test** — Covered in the unit tests (mocked) and in integration tests: `tests/integration/transfers.api.test.ts` (“returns same response for duplicate reference”). Same body twice returns the same `data.transfer.id` and only one transfer and two ledger entries in the DB.
- **Concurrency test** — `tests/integration/concurrency.test.ts` runs many concurrent POSTs from the same source and asserts final balances and ledger sums. The script `tests/concurrency/run-concurrent-transfers.ts` (and optional demo endpoint) simulate concurrent and duplicate-reference scenarios.
- **Failure scenario (insufficient funds)** — In `tests/integration/transfers.api.test.ts`, a POST with an amount larger than the source balance is sent; the test expects 422 and `INSUFFICIENT_BALANCE` and asserts that balances and transfer/ledger row counts are unchanged.

### Important constraints (all satisfied)

- **No in-memory database** — Unit tests use mocks; integration and concurrency tests use a real Postgres database (e.g. `stellas_transfer_test`).
- **No skipping double-entry** — Every transfer creates one DEBIT and one CREDIT ledger entry and updates both accounts’ balances; no “balance-only” transfer is performed.
- **No updating balances outside transactions** — Balance changes happen only inside the single transaction in `TransferService.executeTransfer`, via `AccountRepository.updateBalances(..., transaction)`.
- **No simplified balance-only implementations** — Both `available_balance` and `ledger_balance` are maintained, ledger entries are persisted, and an audit row is written for each transfer.
