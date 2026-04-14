import pino from 'pino';
import { env } from './env';
import { getTraceId } from '../traceContext';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  // Called on every log write — merges traceId into the record automatically.
  mixin() {
    const traceId = getTraceId();
    return traceId ? { traceId } : {};
  },
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    },
  }),
});
