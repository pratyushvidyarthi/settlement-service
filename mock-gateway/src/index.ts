import express from 'express';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const PORT = Number(process.env.GATEWAY_PORT ?? 4000);

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});

const app = express();
app.use(express.json());

const CaptureRequestSchema = z.object({
  preAuthId:      z.string(),
  amountCents:    z.number().int().positive(),
  idempotencyKey: z.string(),
  metadata:       z.record(z.string()).optional(),
});

// Total failure rate = 1/6 (~16.7%), split evenly between the two failure modes.
const RATE_HARD_ERROR = 1 / 12; // immediate 500
const RATE_TIMEOUT    = 1 / 12; // hang until the client times out

// Must be longer than the settlement service's axios timeout (10 s) so the
// client always gives up before the gateway eventually responds.
const SIMULATED_TIMEOUT_MS = Number(process.env.GATEWAY_TIMEOUT_MS ?? 15_000);

function roll(): 'hard_error' | 'timeout' | 'success' {
  const r = Math.random();
  if (r < RATE_HARD_ERROR)                  return 'hard_error';
  if (r < RATE_HARD_ERROR + RATE_TIMEOUT)   return 'timeout';
  return 'success';
}

app.post('/capture', (req, res) => {
  const parsed = CaptureRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'validation_error', details: parsed.error.flatten() });
    return;
  }

  const { amountCents } = parsed.data;
  const outcome = roll();

  if (outcome === 'hard_error') {
    logger.warn({ outcome }, 'capture: gateway internal error');
    res.status(500).json({ error: 'gateway_error', message: 'Internal gateway failure' });
    return;
  }

  if (outcome === 'timeout') {
    logger.warn({ outcome, holdMs: SIMULATED_TIMEOUT_MS }, 'capture: holding connection to simulate timeout');
    const timer = setTimeout(() => res.end(), SIMULATED_TIMEOUT_MS);
    res.on('close', () => clearTimeout(timer));
    return;
  }

  const response = {
    captureId:   `cap_${uuidv4()}`,
    status:      'succeeded',
    amountCents,
  };

  logger.info(response, 'capture: succeeded');
  res.status(200).json(response);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  logger.info(`mock-gateway listening on port ${PORT}`);
});
