import 'dotenv/config';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { env } from '../config/env';

const sqlite = new Database(env.DATABASE_URL);
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: './src/db/migrations' });

console.log('Migrations applied successfully');
sqlite.close();
