import { cleanEnv, str, port, num } from 'envalid';
import dotenv from 'dotenv';

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 3000 }),
  LOG_LEVEL: str({ choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'], default: 'info' }),

  // Version: set APP_VERSION at build time (e.g. Docker ARG); API prefix
  APP_VERSION: str({ default: '1.0.0' }),
  API_VERSION: str({ default: 'v1' }),

  // Database: use DATABASE_URL or separate vars
  DATABASE_URL: str({ default: '' }),
  DB_HOST: str({ default: 'localhost' }),
  DB_PORT: num({ default: 5432 }),
  DB_NAME: str({ default: 'stellas_transfer' }),
  DB_USER: str({ default: 'postgres' }),
  DB_PASSWORD: str({ default: '' }),

  // Optional: run migrations on app startup (e.g. in Docker)
  RUN_MIGRATIONS_ON_START: str({ choices: ['true', 'false'], default: 'true' }),
  // Optional: run db seed on app startup (e.g. in Docker for demo accounts)
  RUN_SEED_ON_START: str({ choices: ['true', 'false'], default: 'true' }),

  // Test helpers: account creation and balance top-up. Set to 'true' to enable in any env.
  ALLOW_TEST_ENDPOINTS: str({ choices: ['true', 'false'], default: 'true' }),
});

/** True when test-only endpoints (e.g. create account, top-up) are enabled. */
export const isTestEndpointsAllowed =
  env.ALLOW_TEST_ENDPOINTS === 'true' || env.NODE_ENV !== 'production';

export type Env = typeof env;
