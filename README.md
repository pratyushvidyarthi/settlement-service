# settlement-service

Receives `BookingCompleted` events, computes the final charge (base fare + usage overage at $0.25 per unit over the included allowance + late return fee at $15 per hour rounded up to the nearest hour), captures it against a pre-authorization held on the customer's card, writes an immutable settlement record, and exposes it via a GET endpoint. A small mock payment gateway runs alongside it and is intentionally flaky to exercise the retry and idempotency logic.

---

## Running it

First time only:

```sh
cp .env.example .env
docker compose up --build
```

Settlement service runs on `localhost:3000`, mock gateway on `localhost:4000`.

For local development without Docker:

```sh
npm run dev
```

To run the test suite:

```sh
npm test
```

---

## Key design decisions

**Two-layer idempotency.** The handler checks for an existing settlement by `bookingId` before doing anything. If one exists it returns immediately without touching the gateway. The hard guarantee is a `UNIQUE` constraint on `booking_id` in SQLite — if two identical events race past the soft check simultaneously, the second insert throws a constraint violation rather than double-charging.

**Immutable settlements.** Once written, a settlement row is never updated. If the gateway fails after all retries, a row with `status: failed` is written anyway. Silence is never the outcome — there is always an audit trail.

**SQLite with WAL mode.** Sufficient for a single-writer event processor with no infrastructure overhead. The DB file lives in a named Docker volume so data survives container restarts.

**AsyncLocalStorage for trace IDs.** Every log line gets a `traceId` automatically without passing a logger instance through every function. The middleware also honours an incoming `x-trace-id` header so traces stay correlated if another service forwards the request.

**Retry with exponential backoff.** The gateway client retries up to 3 times on timeouts and 5xx errors with jitter. 4xx responses are not retried — a bad request will always be a bad request. The idempotency key sent to the gateway is `capture:bookingId`, stable across every retry attempt.

---

## Tradeoffs

SQLite is single-writer. This works cleanly for a background event processor but would not scale horizontally — Postgres would be the production choice.

Events arrive over HTTP directly. In production this would sit behind a message queue so events survive service restarts and can be replayed.

The mock gateway is intentionally minimal — one file, one endpoint, roughly 1 in 6 calls fail either immediately with a 500 or by holding the connection open until the client times out.

---

## What I'd do with more time

A dead letter queue for events that exhaust all gateway retries, so nothing is silently dropped.

Prometheus metrics on capture success rate, retry count, and latency percentiles — the structured logs are there but aggregation requires more.

An end-to-end integration test that spins up the full Docker Compose stack and runs the booking flow from event to settlement.

A migration path to Postgres with connection pooling for horizontal scaling.
