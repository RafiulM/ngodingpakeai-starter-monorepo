# Architecture

Two apps and one shared package in a pnpm + Turborepo workspace, backed by one PostgreSQL database.

```text
packages/shared/src/
  validators/notes.ts         strict zod input schemas (API parses, web types forms)
  permissions.ts              RBAC statement, roles, roleHasPermission()
  types/api.ts                response DTOs as the browser receives them (ISO dates)
  site.ts                     identity from starter.config.json

apps/api/src/                 Express 5 + TypeScript, run with tsx (dev) / tsup bundle (prod)
  server.ts                   listen, startup log, graceful shutdown, crash logging
  app.ts                      createApp(): middleware order (see below)
  load-env.ts                 reads the repository root's .env.local / .env
  migrate.ts, set-role.ts     CLI entrypoints (pnpm db:migrate, pnpm role:set)
  config/env.ts               validated environment, trusted origins, log level
  db/schema/*.ts              one Drizzle table per file; index.ts exports all
  db/index.ts                 shared node-postgres pool + Drizzle
  lib/auth.ts                 Better Auth server (admin plugin, trusted origins)
  lib/logger.ts               pino: JSON in production, pretty in development
  lib/request-context.ts      AsyncLocalStorage { reqId, userId } for every log line
  middleware/                 requireAuth, requirePermission, requireTrustedOrigin,
                              jsonBody, noStore, notFound + errorHandler
  routes/                     index.ts mounts health, notes, admin routers
  services/notes.service.ts   application rules and every Notes query
  test/                       vitest + supertest against disposable PostgreSQL
apps/api/drizzle/             committed SQL migrations + metadata

apps/web/src/                 TanStack Start (Vite + Nitro node server)
  start.ts                    request middleware: security headers, CSRF for server fns,
                              access log + reqId
  router.tsx                  per-request QueryClient + SSR query integration
  routes/__root.tsx           html shell; beforeLoad reads the session into context
  routes/_auth*, _protected*  sign-in/up; guarded app, notes, admin pages
  lib/auth-client.ts          Better Auth browser client → API origin
  lib/auth.middleware.ts      server fn middleware: session from the API via cookie
  lib/session.ts              getSessionFn (uses authMiddleware)
  lib/session.server.ts       server-side Better Auth client; Set-Cookie relay
  lib/api/client.ts           apiFetch + ApiError (isomorphic)
  lib/api/upstream.server.ts  internal API URL, forwarded cookie + reqId, SSR error logs
  lib/logger.server.ts        pino for the web server
  features/notes/             api.ts → queries.ts → hooks.ts → components/
  features/admin/             cross-account notes hooks
  components/ui/              shadcn/ui source, owned by this project
```

## Request flow

```text
Browser ──(cookie, Origin: WEB_URL)──▶ Express API (BETTER_AUTH_URL)
   ▲                                     │ requireAuth → requireTrustedOrigin
   │ HTML + dehydrated queries           │ → validator → service → Drizzle → PostgreSQL
   │                                     ▲
Web server (WEB_URL) ──(forwarded cookie, X-Request-Id)──┘  during SSR
```

**Sign in.** The browser form calls Better Auth on the API origin (`authClient`, `credentials: "include"`). Better Auth checks the Origin against `trustedOrigins`, validates credentials, and sets an httpOnly session cookie for the API host. Cookies are scoped by host, not port, so in development the same cookie is also sent to the web app on `localhost:3000`. In production `COOKIE_DOMAIN` (e.g. `.example.com`) shares it between `api.` and `app.` subdomains.

**Page render.** The root route's `beforeLoad` calls `getSessionFn`, a server function wrapped by `authMiddleware`. On the web server it forwards the visitor's cookie to `GET /api/auth/get-session` (via `API_INTERNAL_URL` when set) and relays any refreshed `Set-Cookie`. The `_protected` layout redirects when the session is missing. Loaders call `queryClient.ensureQueryData(...)`; on the server `apiFetch` forwards the cookie and the request ID, so the HTML already contains the user's data and the browser hydrates the cache instead of refetching.

**Browser interactions.** Components use custom hooks (`useNotes`, `useCreateNote`, …) that call `apiFetch` directly against the API origin with cookies. The browser adds the `Origin` header the API's CSRF check requires. Mutations update or invalidate the query cache.

**Authorization.** The API is the authority: `requireAuth` reads the session from the database on every request (no cookie cache), so signing out or revoking a session takes effect immediately; `requirePermission` reads the stored role. The web app's `roleHasPermission` only decides what to show.

## API middleware order (`app.ts`)

1. `helmet` (CORP `same-site`), `trust proxy` from `TRUST_PROXY`
2. request context (reqId from a safe `X-Request-Id` or a new UUID) + `pino-http` access log
3. `cors` for trusted origins with credentials, exposing `X-Request-Id` and `Location`
4. client IP header for Better Auth's per-IP rate limits (from `req.ip`, never client-supplied)
5. Better Auth at `/api/auth/*splat` — before any body parser, because it reads the raw stream; `limitAuthBody` first refuses bodies over 100 kB (413) or streamed without `Content-Length` (411)
6. `/api` routers: `noStore`, then per router `requireAuth` → `requireTrustedOrigin` → (`requirePermission`) → `jsonBody` on POST/PATCH → handler
7. `notFound`, `errorHandler` (HttpError, Zod 422, JSON 400/413, generic 500)

Express 5 forwards rejected promises from async handlers and middleware to the error handler, so handlers simply `throw`.

## Logging

Both servers log with pino: one JSON object per line in production (ready for Docker logs, Loki, Datadog, …) and colorized single lines in development.

- Every API request gets one access line (`GET /api/notes 200 8ms`) at `info`, `warn` for 4xx, `error` for 5xx; health checks log at `debug`.
- An AsyncLocalStorage context adds `reqId` and, once authenticated, `userId` to every line — including anything a service logs with `import { logger }`.
- The web server's request middleware logs SSR pages and server functions, and forwards its `X-Request-Id` to the API. One ID traces a page render across both servers.
- Unexpected errors are logged once, with their stack, on the access line (`res.err`); the client gets a generic 500.
- Better Auth's own logs go through the same logger (`module: "better-auth"`); `LOG_SQL=true` adds Drizzle query lines (`module: "db"`, parameters omitted).
- Cookie, authorization, and `set-cookie` headers are redacted, as are `password`, `newPassword`, `currentPassword`, `token`, and `secret` fields one level inside a logged object (e.g. `{ user: { password } }`); query parameters that look like credentials are blanked in URLs. Redaction is a safety net: never log request bodies or credentials in the first place.
- `LOG_LEVEL` overrides the defaults (`debug` in development, `info` in production, `silent` in API tests).

## Development loop

`pnpm dev` runs `scripts/prepare.mjs` (settings, database, migrations) and then `turbo run dev`:

- **API**: `tsx watch` restarts the process on any change to `apps/api/src`, `packages/shared/src`, or the root `.env.local`/`.env`. `server.ts` closes the HTTP server and the pg pool on SIGTERM, so restarts take well under a second without `EADDRINUSE` or leaked connections.
- **Web**: Vite HMR, including edits in `packages/shared`.

Each dev server takes its port from its URL (`BETTER_AUTH_URL`, `WEB_URL`), so the origins the API trusts always match the addresses you open.

## Data and configuration

One ignored root `.env.local` serves both apps (process environment wins, then `.env.local`, then `.env`). `pnpm run setup` appends only missing values. `DATABASE_URL` configures runtime PostgreSQL; `MIGRATION_DATABASE_URL` optionally supplies a direct migration connection. The API pool allows ten connections per process with timeouts and an idle-error handler. Tests always provision their own disposable PostgreSQL server.

Schema updates use `pnpm db:generate` then `pnpm db:migrate`. Startup never pushes schema, erases tables, or seeds accounts.

## Dependency notes

TypeScript 5.9 and ESLint 9 are pinned with `typescript-eslint` and `eslint-plugin-react-hooks`. Shared versions (better-auth, drizzle-orm, pg, pino, zod, TypeScript) come from the pnpm catalog in `pnpm-workspace.yaml`. pnpm blocks dependency install scripts unless listed under `allowBuilds`. The `@esbuild-kit/core-utils` override updates Drizzle Kit's legacy nested esbuild to the patched 0.25.12. Turborepo runs in `envMode: "loose"` so your shell environment reaches both apps, matching the precedence above.
