import type { RequestHandler } from "express";

// Application API responses are per-user; never let a cache keep them.
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
};
