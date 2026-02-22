import { env } from './env';

function getDatabaseUrl(): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = env;
  const encoded = encodeURIComponent(DB_PASSWORD);
  return `postgres://${DB_USER}:${encoded}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

export const databaseConfig = {
  url: getDatabaseUrl(),
  dialect: 'postgres' as const,
  logging: env.NODE_ENV === 'development' ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  define: {
    underscored: true,
    timestamps: true,
  },
};

// For sequelize-cli: must export config keyed by environment
export default {
  development: databaseConfig,
  test: { ...databaseConfig, logging: false },
  production: { ...databaseConfig, logging: false },
};
