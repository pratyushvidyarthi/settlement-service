import { eq } from 'drizzle-orm';
import { db } from './client';
import { settlements, type NewSettlement, type Settlement } from './schema';

// better-sqlite3 is synchronous — no async needed here.

export function insert(data: NewSettlement): Settlement {
  return db.insert(settlements).values(data).returning().get();
}

export function findById(id: string): Settlement | undefined {
  return db.select().from(settlements).where(eq(settlements.id, id)).get();
}

export function findByBookingId(bookingId: string): Settlement | undefined {
  return db.select().from(settlements).where(eq(settlements.bookingId, bookingId)).get();
}

export function list(): Settlement[] {
  return db.select().from(settlements).orderBy(settlements.createdAt).all();
}
