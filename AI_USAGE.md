# AI Usage

## Tools used

Claude Code in VS Code throughout the entire build, from project scaffolding to the final code review pass.

---

## Two prompts that worked well

**The retry client.** I asked Claude to build the gateway client with retry logic and make the idempotency key derived from the `bookingId`. It did that, but it also added a `capture:` namespace prefix to the key unprompted — so the key becomes `capture:bk_xyz` rather than just `bk_xyz`. Small detail but correct: if the same `bookingId` were ever used in a different operation context the keys would not collide. I did not ask for that thinking, it just applied it.

The prompt was roughly: *"the idempotency key going into each capture request should be derived from the bookingId so retrying the same booking never double-charges."*

**The final review pass.** I asked Claude to do a sweep for anything rough before wrapping up. It found a real bug in `settlementService.ts`: the original try-catch wrapped both the gateway capture call and the DB insert together. If the capture succeeded but the insert threw a UNIQUE constraint violation — which happens when two identical events race through simultaneously — the catch block would attempt to write a `failed` settlement row, which would also throw UNIQUE, producing an uncaught error that looked exactly like a gateway failure but was not. The fix was separating capture outcome from insert with a discriminated union and a dedicated handler for the constraint violation case. I did not ask it to find bugs specifically, I just asked for a final check.

The prompt was roughly: *"do a final pass — any rough edges, missing error handling, anything that would look sloppy in a code review?"*

---

## One place the AI was wrong, and how I caught it

Claude designed the inbound event validation with a nested envelope structure — fields like `eventType` set to `"booking.completed"`, an `eventId`, an `occurredAt` timestamp, and all the booking fields nested under a `data` key. It looks like a reasonable event schema in isolation and would pass a code review without comment.

The spec payload is completely flat. The event field is called `event` with value `"BookingCompleted"` and every booking field sits at the top level alongside it.

It only surfaced when I tested with the exact example payload from the spec and got a 422 validation error rejecting every single field. The fix was straightforward — update the Zod schema to match the actual shape — but it would have been invisible without running it against the real input. The lesson I took from it: test with the spec's exact example as early as possible, before everything else is wired together.
