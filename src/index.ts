import { execSync } from 'child_process';
import path from 'path';
import { env } from './config';
import { logger } from './utils/logger';
import { sequelize } from './models';
import { app } from './app';

async function runMigrations(): Promise<void> {
  const cwd = path.join(__dirname, '..');
  execSync('npx sequelize-cli db:migrate', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: env.NODE_ENV },
    cwd,
  });
  logger.info('Migrations completed');
}

async function runSeed(): Promise<void> {
  const cwd = path.join(__dirname, '..');
  execSync('npx sequelize-cli db:seed:all', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: env.NODE_ENV },
    cwd,
  });
  logger.info('Seed completed');
}

async function start(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Database connected');
  } catch (err) {
    logger.error({ err }, 'Database connection failed');
    process.exit(1);
  }

  if (env.RUN_MIGRATIONS_ON_START === 'true') {
    await runMigrations();
  }

  if (env.RUN_SEED_ON_START === 'true') {
    await runSeed();
  }

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, version: env.APP_VERSION }, 'Server listening');
  });
}

start().catch((err) => {
  logger.fatal({ err }, 'Startup failed');
  process.exit(1);
});

export { app };
