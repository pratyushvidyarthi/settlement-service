import axios from 'axios';
import { gatewayClient, type CaptureResponse } from '../gateway/client';
import { logger } from '../config/logger';

const MAX_ATTEMPTS  = 3;
const BASE_DELAY_MS = 500;

// The idempotency key is derived deterministically from the bookingId so that
// every retry for the same booking sends the same key. The gateway uses this
// to deduplicate: a second capture with the same key returns the original
// result instead of charging again.
function idempotencyKeyFor(bookingId: string): string {
  return `capture:${bookingId}`;
}

function isRetryable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  // No response at all → network timeout or connection refused
  if (!err.response) return true;
  // Gateway internal error — transient, worth retrying
  if (err.response.status === 500) return true;
  // 422 validation error means our request is malformed; retrying won't help
  return false;
}

// Exponential backoff with ±25 % jitter to avoid a thundering herd of retries.
function backoffMs(attempt: number): number {
  const base   = BASE_DELAY_MS * 2 ** attempt;
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
    public readonly attempts: number,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export async function capturePayment(
  bookingId:   string,
  preAuthId:   string,
  amountCents: number,
): Promise<CaptureResponse> {
  const idempotencyKey = idempotencyKeyFor(bookingId);
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = backoffMs(attempt - 1);
      logger.warn(
        { attempt, maxAttempts: MAX_ATTEMPTS, delayMs: delay },
        'capture failed, retrying after backoff',
      );
      await sleep(delay);
    }

    try {
      const result = await gatewayClient.capture({ preAuthId, amountCents, idempotencyKey });
      if (attempt > 0) {
        logger.info({ attempt }, 'capture succeeded after retry');
      }
      return result;
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) {
        logger.error({ attempt, err }, 'capture failed with non-retryable error');
        break;
      }
    }
  }

  throw new GatewayError(
    `Capture failed after ${MAX_ATTEMPTS} attempt(s)`,
    lastError,
    MAX_ATTEMPTS,
  );
}
