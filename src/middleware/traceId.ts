import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { runWithTraceId } from '../traceContext';

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Honour a trace ID forwarded by an upstream caller so distributed traces
  // stay correlated. Fall back to a fresh UUID for requests that originate here.
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();

  res.setHeader('x-trace-id', traceId);

  // Run the rest of the request pipeline inside the AsyncLocalStorage context.
  // Node propagates this context through all async continuations spawned here,
  // so the logger can read it without it being passed explicitly.
  runWithTraceId(traceId, () => next());
}
