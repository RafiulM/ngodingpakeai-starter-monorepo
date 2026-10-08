import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import { logger } from "@/lib/logger.server";
import { runWithRequestContext } from "@/lib/request-context.server";

const STATIC_ASSET =
  /\.(?:js|mjs|css|map|svg|png|jpe?g|gif|webp|ico|woff2?|txt)$/;

// Browser hardening for every page and server function response. Other sites
// cannot frame the app (CSP frame-ancestors, plus X-Frame-Options for older
// browsers). A script-src policy needs per-request nonces for Start's inline
// scripts, so add one deliberately when your app needs it. HSTS is sent only
// in production, so a local HTTPS setup never pins a development hostname.
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  ...(process.env.NODE_ENV === "production"
    ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
    : {}),
};

// A route that sets one of these headers itself keeps its own value.
const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS))
    if (!result.response.headers.has(name))
      result.response.headers.set(name, value);
  return result;
});

// Every request the web server handles (SSR pages, server routes, server
// functions) gets a request ID and one access-log line. The ID is forwarded to
// the API by the session lookup and apiFetch during SSR.
const requestLogger = createMiddleware().server(async ({ request, next }) => {
  const { pathname } = new URL(request.url);
  if (STATIC_ASSET.test(pathname) || pathname.startsWith("/@")) return next();
  return runWithRequestContext(
    request.headers.get("x-request-id"),
    async (reqId) => {
      const started = performance.now();
      try {
        const result = await next();
        const status = result.response.status;
        result.response.headers.set("X-Request-Id", reqId);
        const line = `${request.method} ${pathname} ${status} ${Math.round(performance.now() - started)}ms`;
        if (status >= 500) logger.error(line);
        else if (status >= 400) logger.warn(line);
        else logger.info(line);
        return result;
      } catch (err) {
        // Redirects and not-found are thrown as control flow; let Start
        // handle them and only record real failures.
        if (err instanceof Error)
          logger.error(
            { err },
            `${request.method} ${pathname} failed after ${Math.round(performance.now() - started)}ms`,
          );
        throw err;
      }
    },
  );
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    // First, so it also covers responses the CSRF check refuses.
    securityHeaders,
    // A custom start.ts replaces Start's defaults, so CSRF protection for
    // server functions must be added back explicitly.
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }),
    requestLogger,
  ],
}));
