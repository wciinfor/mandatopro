import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize:      true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore:        'pid,hostname',
      },
    },
  }),
  base: { service: 'disparo-pro-api' },
});
