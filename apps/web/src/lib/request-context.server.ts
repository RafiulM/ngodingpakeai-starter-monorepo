import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type RequestContext = { reqId: string };

const storage = new AsyncLocalStorage<RequestContext>();
const SAFE_REQUEST_ID = /^[\w-]{1,128}$/;

export function getRequestContext() {
  return storage.getStore();
}

// Reuses a well-formed incoming X-Request-Id (e.g. from a load balancer),
// otherwise mints one, and runs the rest of the request inside that context.
export function runWithRequestContext<T>(
  incoming: string | null,
  fn: (reqId: string) => T,
) {
  const reqId =
    incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  return storage.run({ reqId }, () => fn(reqId));
}
