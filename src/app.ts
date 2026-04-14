import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { apiRouter } from './routes';
import { traceIdMiddleware } from './middleware/traceId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(traceIdMiddleware); // must be before requestLogger
  app.use(requestLogger);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1', apiRouter);

  app.use(errorHandler);

  return app;
}
