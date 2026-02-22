/**
 * Runs before test files. Ensures test env uses test DB so integration tests don't touch dev DB.
 */
process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  process.env.DB_NAME = 'stellas_transfer_test';
}
