import type { Request, RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Permissions } from "@starter/shared/permissions";
import { auth } from "../lib/auth";
import { HttpError } from "../lib/http-error";
import { setRequestUser } from "../lib/request-context";

// Authenticates against the database on every request (no cookie cache), so a
// signed-out or revoked session stops working immediately. Answers JSON 401.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
    query: { disableCookieCache: true },
  });
  if (!session)
    throw new HttpError(401, "UNAUTHORIZED", "Sign in to continue.");
  req.auth = session;
  setRequestUser(session.user.id);
  next();
};

// Role check for endpoints that reach past the caller's own rows. Reads the
// stored role, so a revoked role takes effect on the next request. Mount after
// requireAuth. Hiding UI in the web app is never the access check.
export function requirePermission(permissions: Permissions): RequestHandler {
  return async (req, _res, next) => {
    const { success } = await auth.api.userHasPermission({
      body: { userId: getAuth(req).user.id, permissions },
    });
    if (!success)
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Your account cannot perform this action.",
      );
    next();
  };
}

// The verified session inside a handler mounted after requireAuth.
export function getAuth(req: Request) {
  if (!req.auth)
    throw new Error("getAuth() used on a route without requireAuth");
  return req.auth;
}
