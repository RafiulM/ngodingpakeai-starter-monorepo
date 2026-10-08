import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth.middleware";

// Route files call this in beforeLoad. It runs on the server (during SSR, and
// via an RPC on client navigation), where authMiddleware forwards the
// visitor's cookie to the API. The root route shares the result as context.
export const getSessionFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => context.session);

export type Session = NonNullable<Awaited<ReturnType<typeof getSessionFn>>>;
