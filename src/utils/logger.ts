import pino from 'pino';
import { env } from '../config';

export const logger = pino({
  level: env.LOG_LEVEL,
});
