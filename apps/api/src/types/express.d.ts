import type { AuthSession } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth after an authoritative Better Auth session lookup.
      auth?: AuthSession;
    }
  }
}

export {};
