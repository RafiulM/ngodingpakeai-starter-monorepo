# Express + TanStack Start + PostgreSQL monorepo base

Derived from the TanStack Start + PostgreSQL base version 0.1.0.

This starter keeps Drizzle with node-postgres, Better Auth with roles (admin plugin and the same access-control statement), Tailwind v4, shadcn/ui, Motion, Context7, the Notes API contract, the Docker development database, the setup scripts, and the project skills. The backend moved to a standalone Express API and the repository became a pnpm + Turborepo monorepo.

Changes:

- `src/routes/api/**` server routes became an Express 5 API in `apps/api` with a routes → services structure. `withApiSession`/`withApiPermission` became `requireAuth`, `requireTrustedOrigin`, and `requirePermission` middleware; errors flow through one Express error handler with the same envelope and status codes.
- Validators and permissions moved to `packages/shared`, used by both apps. Response DTO types were added there.
- The web app (`apps/web`) has no database or Better Auth server. Its Better Auth client points at the API origin with credentials; `authMiddleware` (server function middleware) reads the session from the API by forwarding the visitor's cookie. `hasPermissionFn` became the local `roleHasPermission`, because the session already carries the stored role.
- The browser calls the API cross-origin: CORS and Better Auth `trustedOrigins` allow `WEB_URL`; production shares the cookie with `COOKIE_DOMAIN`. `BETTER_AUTH_URL` now names the API origin.
- Data fetching uses TanStack Query: `apiFetch` (isomorphic, forwards cookies during SSR), query options, custom hooks, SSR prefetch through route loaders. The Notes example gained a UI; an admin page lists and deletes any account's notes.
- Structured logging with pino on both servers, request IDs propagated from web to API, AsyncLocalStorage context, redaction, and Better Auth/Drizzle logs routed into the same stream.
- The API restarts on change with `tsx watch` and shuts down gracefully; dev servers take their ports from their URLs.
- Better Auth receives the client IP from Express (honoring `TRUST_PROXY`) for per-IP rate limits, and `get-session` is exempt so SSR lookups from one web server do not share a bucket.
- Tests: API integration tests (vitest + supertest), root node tests, and Playwright e2e against both production builds; all on disposable PostgreSQL.
- Docker: one Dockerfile per app (turbo prune), the API ships a self-contained tsup bundle plus a migrator target.
