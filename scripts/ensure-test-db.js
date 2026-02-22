/**
 * Creates the test database if it doesn't exist. Used before running tests (locally or in Docker)
 * when the DB only has the default database.
 */
require('dotenv').config();
const { Client } = require('pg');

const dbName = process.env.DB_NAME || 'stellas_transfer_test';
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres',
};

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    const r = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (r.rows.length === 0) {
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Created database: ${dbName}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
