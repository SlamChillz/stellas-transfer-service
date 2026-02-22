'use strict';

require('dotenv').config();

const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const name = process.env.DB_NAME || 'stellas_transfer';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || '';
  const encoded = encodeURIComponent(password);
  return `postgres://${user}:${encoded}@${host}:${port}/${name}`;
};

const base = {
  url: getDatabaseUrl(),
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  define: { underscored: true, timestamps: true },
};

module.exports = {
  development: base,
  test: { ...base, logging: false },
  production: { ...base, logging: false },
};
