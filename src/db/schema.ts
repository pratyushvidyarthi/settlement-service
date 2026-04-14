import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settlements = sqliteTable('settlements', {
  id: text('id').primaryKey(),

  // Booking context
  bookingId: text('booking_id').notNull().unique(),
  userId:    text('user_id').notNull(),

  // Charge breakdown
  baseFareCents:     integer('base_fare_cents').notNull(),
  usageOverageCents: integer('usage_overage_cents').notNull(),
  lateFeeCents:      integer('late_fee_cents').notNull(),
  amountCents:       integer('amount_cents').notNull(),  // sum of the three above

  // What was sent to the gateway
  preAuthId:      text('pre_auth_id').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),

  // What the gateway returned
  status:             text('status', { enum: ['succeeded', 'failed'] }).notNull(),
  gatewayChargeId:    text('gateway_charge_id'),           // null on failure
  failureReason:      text('failure_reason'),              // null on success
  gatewayRawResponse: text('gateway_raw_response', { mode: 'json' })
                        .notNull()
                        .$type<Record<string, unknown>>(),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type Settlement    = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;
