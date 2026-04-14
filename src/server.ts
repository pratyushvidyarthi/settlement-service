import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { env } from './config/env';
import { logger } from './config/logger';
import { db } from './db/client';
import { createApp } from './app';

// Run migrations synchronously before accepting any traffic. Uses the same
// connection as the app so no second DB handle is opened.
migrate(db, { migrationsFolder: './src/db/migrations' });
logger.info('database migrations applied');

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`settlement-service listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});
