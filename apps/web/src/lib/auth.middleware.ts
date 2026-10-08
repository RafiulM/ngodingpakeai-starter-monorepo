import { createMiddleware } from "@tanstack/react-start";
import { fetchSession } from "@/lib/session.server";

// Server function middleware: resolves the visitor's session from the API and
// passes it to the server function as `context.session` (null when signed
// out). The body runs only on the server.
export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => next({ context: { session: await fetchSession() } }),
);

// For server functions that must not run anonymously. A protected layout
// alone does not protect a server function: attach this to each one.
export const requireAuthMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.session) throw new Error("UNAUTHORIZED");
    return next({ context: { session: context.session } });
  });
