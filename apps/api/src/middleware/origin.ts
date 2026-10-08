import type { RequestHandler } from "express";
import { env } from "../config/env";
import { HttpError } from "../lib/http-error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// CSRF protection for cookie-authenticated application mutations, including
// DELETE. Better Auth guards its own /api/auth endpoints; this covers ours.
// Browsers always send Origin on cross-origin fetches; command-line clients
// must set it explicitly.
export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (
    !origin ||
    !env.trustedOrigins.includes(origin) ||
    req.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(
      403,
      "FORBIDDEN_ORIGIN",
      "Send this request from the app's configured origin.",
    );
  next();
};
