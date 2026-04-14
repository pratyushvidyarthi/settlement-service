import { AsyncLocalStorage } from 'async_hooks';

const storage = new AsyncLocalStorage<string>();

export function runWithTraceId<T>(traceId: string, fn: () => T): T {
  return storage.run(traceId, fn);
}

export function getTraceId(): string | undefined {
  return storage.getStore();
}
