import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

type RequestContext = { reqId: string; userId?: string };

const storage = new AsyncLocalStorage<RequestContext>();

// Read by the logger's mixin, so every log line written while a request is in
// flight carries its reqId and, once authenticated, its userId. Services can
// log without receiving the request.
export function getRequestContext() {
  return storage.getStore();
}

export function setRequestUser(userId: string) {
  const store = storage.getStore();
  if (store) store.userId = userId;
}

const SAFE_REQUEST_ID = /^[\w-]{1,128}$/;

// Reuse a well-formed X-Request-Id (the web server forwards its own, so one ID
// traces an SSR render through both servers); otherwise mint a new one.
export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.get("x-request-id");
  const reqId =
    incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.id = reqId;
  res.setHeader("X-Request-Id", reqId);
  storage.run({ reqId }, next);
};
