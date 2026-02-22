/**
 * Express app factory. Used by index.ts for the server and by tests (Supertest) without starting the server.
 * @param options.jsonLimit - Optional body size limit for express.json() (e.g. '50b'). Used in tests to trigger 413.
 */
import { env } from './config';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler } from './middlewares/errorHandler';
import { v1Router } from './routes/v1';
import { docsRoute } from './routes/docs';
import express from 'express';

export interface CreateAppOptions {
  jsonLimit?: string;
}

export function createApp(options?: CreateAppOptions): express.Express {
  const app = express();
  app.use(express.json(options?.jsonLimit ? { limit: options.jsonLimit } : undefined));
  app.use(requestLogger);

  app.get('/docs', docsRoute);

  const apiPrefix = `/api/${env.API_VERSION}`;
  app.get(`${apiPrefix}/health`, (_req, res) => {
    res.status(200).json({
      status: 'ok',
      version: env.APP_VERSION,
      apiVersion: env.API_VERSION,
    });
  });
  app.use(apiPrefix, v1Router);

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      version: env.APP_VERSION,
      apiVersion: env.API_VERSION,
    });
  });

  app.get('/version', (_req, res) => {
    res.status(200).json({ version: env.APP_VERSION, apiVersion: env.API_VERSION });
  });

  app.use(errorHandler);
  return app;
}

export const app = createApp();
