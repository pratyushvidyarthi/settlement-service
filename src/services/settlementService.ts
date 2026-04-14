import { randomUUID } from 'crypto';
import { logger } from '../config/logger';
import * as repo from '../db/settlements.repository';
import type { NewSettlement } from '../db/schema';
import type { BookingCompletedEvent } from '../events/bookingCompleted';
import type { CaptureResponse } from '../gateway/client';
import { calculateCharge } from './chargeCalculator';
import { capturePayment, GatewayError } from './chargeService';

export async function processBookingCompleted(event: BookingCompletedEvent): Promise<void> {
  const {
    bookingId, userId, preAuthId,
    baseFareCents, actualUnits, includedUnits,
    scheduledEnd, actualEnd,
  } = event;

  // ── 1. Idempotency ────────────────────────────────────────────────────────
  // The UNIQUE constraint on booking_id is the authoritative guarantee.
  // This check is the fast path: it avoids work when a duplicate arrives
  // and the first attempt has already finished. Concurrent duplicates that
  // race past this check are caught by the constraint at insert time (step 4).
  const existing = repo.findByBookingId(bookingId);
  if (existing) {
    logger.info(
      { bookingId, settlementId: existing.id, status: existing.status },
      'settlement already exists for this booking, skipping',
    );
    return;
  }

  // ── 2. Calculate charge ───────────────────────────────────────────────────
  const breakdown = calculateCharge({
    baseFareCents,
    actualUnits,
    includedUnits,
    scheduledEndAt: new Date(scheduledEnd),
    actualEndAt:    new Date(actualEnd),
  });

  logger.info({ bookingId, ...breakdown }, 'charge calculated');

  // ── 3. Attempt capture ────────────────────────────────────────────────────
  // Separated from the insert below so a failed insert cannot be mistaken
  // for a failed capture.
  const settlementId   = randomUUID();
  const idempotencyKey = `capture:${bookingId}`;

  type CaptureOutcome =
    | { ok: true;  capture: CaptureResponse }
    | { ok: false; failureReason: string; errorData: Record<string, unknown> };

  let outcome: CaptureOutcome;

  try {
    const capture = await capturePayment(bookingId, preAuthId, breakdown.amountCents);
    logger.info({ bookingId, captureId: capture.captureId, amountCents: capture.amountCents }, 'capture succeeded');
    outcome = { ok: true, capture };
  } catch (err) {
    logger.error(
      { bookingId, err, attempts: err instanceof GatewayError ? err.attempts : undefined },
      'capture exhausted, recording failed settlement',
    );
    outcome = {
      ok: false,
      failureReason: err instanceof GatewayError ? err.message : 'Unexpected error during capture',
      errorData:     serializeError(err),
    };
  }

  // ── 4. Write settlement ───────────────────────────────────────────────────
  const record: NewSettlement = outcome.ok
    ? {
        id: settlementId, bookingId, userId, ...breakdown,
        preAuthId, idempotencyKey,
        status:             'succeeded',
        gatewayChargeId:    outcome.capture.captureId,
        failureReason:      null,
        gatewayRawResponse: outcome.capture as unknown as Record<string, unknown>,
      }
    : {
        id: settlementId, bookingId, userId, ...breakdown,
        preAuthId, idempotencyKey,
        status:             'failed',
        gatewayChargeId:    null,
        failureReason:      outcome.failureReason,
        gatewayRawResponse: outcome.errorData,
      };

  try {
    repo.insert(record);
    logger.info({ bookingId, settlementId, status: record.status }, 'settlement recorded');
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      // A concurrent duplicate raced past the idempotency check and committed
      // first. Our attempt is redundant — not an error.
      logger.info({ bookingId }, 'concurrent duplicate settled first, discarding');
      return;
    }
    throw err;
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof GatewayError) {
    return {
      message:  err.message,
      attempts: err.attempts,
      cause:    err.cause instanceof Error ? err.cause.message : String(err.cause),
    };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}
