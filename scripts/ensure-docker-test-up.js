/**
 * Ensures docker compose --profile test is up (at least the DB) before running tests.
 * Starts the stack and waits for the DB to be ready.
 */
require('dotenv').config();
const { execSync } = require('child_process');
const { Client } = require('pg');

const maxAttempts = 30;
const delayMs = 1000;

async function waitForDb() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres',
  };

  for (let i = 0; i < maxAttempts; i++) {
    const client = new Client(config);
    try {
      await client.connect();
      await client.query('SELECT 1');
      return;
    } catch {
      // not ready yet
    } finally {
      await client.end().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('Database did not become ready in time');
}

function main() {
  // Already inside the test container (e.g. docker compose run test): DB is the "db" service.
  // Skip starting docker compose and just wait for the DB.
  const host = process.env.DB_HOST || 'localhost';
  if (host !== 'localhost' && host !== '127.0.0.1') {
    console.log('Inside container: waiting for DB at', host, '...');
    return waitForDb();
  }
  console.log('Ensuring docker compose --profile test is up...');
  execSync('docker compose --profile test up -d', { stdio: 'inherit' });
  return waitForDb();
}

main()
  .then(() => {
    console.log('Docker test stack is ready.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
