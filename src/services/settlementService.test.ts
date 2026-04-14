import { vi, describe, it, expect, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock factories and before module imports.
// require() here is raw Node — Vitest's TS transform doesn't apply, so we
// can only load JS/native modules (no .ts source files).
// We build the in-memory SQLite with a raw CREATE TABLE instead of the schema
// module to avoid that restriction.
const { testDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as any;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3') as typeof import('drizzle-orm/better-sqlite3');

  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  // Mirror src/db/schema.ts — keep in sync if columns change.
  sqlite.exec(`
    CREATE TABLE settlements (
      id                   TEXT    NOT NULL PRIMARY KEY,
      booking_id           TEXT    NOT NULL UNIQUE,
      user_id              TEXT    NOT NULL,
      base_fare_cents      INTEGER NOT NULL,
      usage_overage_cents  INTEGER NOT NULL,
      late_fee_cents       INTEGER NOT NULL,
      amount_cents         INTEGER NOT NULL,
      pre_auth_id          TEXT    NOT NULL,
      idempotency_key      TEXT    NOT NULL,
      status               TEXT    NOT NULL,
      gateway_charge_id    TEXT,
      failure_reason       TEXT,
      gateway_raw_response TEXT    NOT NULL,
      created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  // No schema arg needed — we only use the query-builder API, not relational queries.
  return { testDb: drizzle(sqlite) };
});

// Swap the real DB connection for the in-memory instance.
vi.mock('../db/client', () => ({ db: testDb }));

// Replace the gateway with a controllable spy.
vi.mock('../gateway/client', () => ({
  gatewayClient: {
    capture: vi.fn().mockResolvedValue({
      captureId:   'cap_test-abc123',
      status:      'succeeded' as const,
      amountCents: 12_425,
    }),
  },
}));

// Imports run after the mocks above are in place.
import { settlements }            from '../db/schema';
import { gatewayClient }         from '../gateway/client';
import { processBookingCompleted } from './settlementService';
import type { BookingCompletedEvent } from '../events/bookingCompleted';

const mockCapture = vi.mocked(gatewayClient.capture);

// Minimal valid event matching the current Zod schema.
const event: BookingCompletedEvent = {
  event:         'BookingCompleted',
  bookingId:     'booking-abc-123',
  userId:        'user-xyz-456',
  preAuthId:     'auth-preauth-999',
  baseFareCents: 8_500,
  actualUnits:   237,
  includedUnits: 200,
  scheduledEnd:  '2024-01-01T18:00:00Z',
  actualEnd:     '2024-01-01T19:30:00Z',
};

beforeEach(() => {
  testDb.delete(settlements).run();
  mockCapture.mockReset().mockResolvedValue({
    captureId:   'cap_test-abc123',
    status:      'succeeded' as const,
    amountCents: 12_425,
  });
});

describe('processBookingCompleted — idempotency', () => {
  it('processing the same event 10 times calls the gateway once and writes one row', async () => {
    // Sequential — models at-least-once message delivery where the consumer
    // processes the same message multiple times.
    for (let i = 0; i < 10; i++) {
      await processBookingCompleted(event);
    }

    expect(mockCapture).toHaveBeenCalledTimes(1);

    const rows = testDb.select().from(settlements).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].bookingId).toBe(event.bookingId);
    expect(rows[0].status).toBe('succeeded');
    expect(rows[0].amountCents).toBe(12_425);
  });

  it('records a failed settlement when the gateway is permanently down', async () => {
    mockCapture.mockRejectedValue(new Error('connection refused'));

    await processBookingCompleted(event);

    const rows = testDb.select().from(settlements).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].gatewayChargeId).toBeNull();
  });

  it('a failed settlement blocks future duplicate events — no retry, no overwrite', async () => {
    mockCapture.mockRejectedValue(new Error('connection refused'));
    await processBookingCompleted(event);

    // Gateway recovers. Fire the same event again.
    mockCapture.mockResolvedValue({
      captureId:   'cap_test-abc123',
      status:      'succeeded' as const,
      amountCents: 12_425,
    });
    await processBookingCompleted(event);

    const rows = testDb.select().from(settlements).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('failed');       // not overwritten
    expect(mockCapture).toHaveBeenCalledTimes(1); // not retried
  });
});
