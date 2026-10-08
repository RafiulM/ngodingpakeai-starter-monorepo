# Build on this starter

This is the **Express + TanStack Start + PostgreSQL monorepo** of the ngodingpakeai starter family. An Express 5 API (Better Auth, Drizzle, RBAC) and a TanStack Start web app live side by side and share one TypeScript contract package. Help beginners turn a plain-language idea into a working app. Keep explanations short, explain decisions in familiar words, and implement the smallest useful feature end to end. Ask only about product decisions that materially change the work.

## First prompt: set up, then build

A request to build or run an app includes preparing its local development environment. Do this on the first feature prompt even if the user never asks about a database. For read-only questions or reviews, do not start services unnecessarily.

1. Read `README.md`, `package.json`, and `.agents/skills/starter-setup/SKILL.md`.
2. If dependencies are missing, run `pnpm run setup`. If installed, run `pnpm dev:prepare` and `pnpm run doctor`. These commands preserve existing settings and data, prepare missing secrets and origins, start managed PostgreSQL, wait for health, and apply committed migrations. Fix a reported setup problem before relying on database behavior.
3. Use the local Docker database by default when no `DATABASE_URL` is supplied. Do not ask beginners to choose a database provider, generate passwords, copy environment files, or create tables. If an existing Docker installation is stopped, start it when permitted. If a prerequisite needs user action, explain the exact action and continue work that does not depend on it.
4. Start `pnpm dev` in a persistent terminal unless it is already running. It starts both apps: the API on `BETTER_AUTH_URL` (default `http://localhost:4000`) and the web app on `WEB_URL` (default `http://localhost:3000`); each dev server takes its port from its URL. Verify both respond (`/api/health` on the API). Avoid duplicate servers.
5. Continue the user's requested feature. Setup alone does not complete a request to build an app.

Always write `pnpm run setup` and `pnpm run doctor`: `pnpm setup` and `pnpm doctor` are pnpm built-ins that ignore this project's scripts. Other scripts (`pnpm dev`, `pnpm test`, `pnpm db:migrate`, …) can be called directly.

Use the relevant skill below. Clients without skill discovery should open its file directly. `agent.md` is an alternate entrypoint to these canonical instructions.

| Task                                                   | Project skill                            |
| ------------------------------------------------------ | ---------------------------------------- |
| First app prompt or setup problem                      | `.agents/skills/starter-setup/SKILL.md`  |
| Start, inspect, stop, or troubleshoot the dev database | `.agents/skills/dev-database/SKILL.md`   |
| Build a feature, change the UI, or add data            | `.agents/skills/build-feature/SKILL.md`  |
| Create a dashboard/chatbot/other derivative            | `.agents/skills/create-variant/SKILL.md` |

## Development database

`compose.dev.yaml` runs PostgreSQL only; both apps run on the host. Use `pnpm db:up`, `db:status`, `db:logs`, and `db:down` so private environment settings and the saved Compose project name are loaded. Fresh setup chooses a free database port, generates credentials, and stores data in a persistent named volume. `db:down` keeps that volume. Preserve `.env.local` and never run volume deletion or destructive resets to repair setup. Supplied external connections bypass Docker. See `docs/local-development.md`.

## Current documentation with Context7

For library, framework, SDK, API, CLI, or cloud-service syntax, configuration, setup, migrations, or library-specific debugging, use Context7 even when the API seems familiar. Do not use it for pure business logic, general programming, or code review without an API question.

1. Call `resolve-library-id` with the library's official name and the actual question, unless the user supplied an exact Context7 library ID.
2. Select the official project or authoritative docs by relevance, reputation, coverage, and installed version. Refine a mismatched search.
3. Call `query-docs` with the resolved ID and a focused question. Use separate queries for unrelated concepts and observe the tool's call limits.
4. Check the examples against the installed version. If Context7 is unavailable, say so, use official documentation, and continue work that does not depend on the missing answer. Do not claim a connection was tested just because its config exists.

Project-scoped MCP files for Codex, Claude Code, Cursor, and VS Code are included. See `docs/ai-workflow.md`. Never put credentials into prompts or committed MCP files.

## Code map and boundaries

```text
apps/api        Express 5 API: Better Auth, Drizzle/PostgreSQL, routes → services
apps/web        TanStack Start web app: pages, Better Auth client, TanStack Query hooks
packages/shared validators (zod), permissions (RBAC), API DTO types, site identity
```

**API (`apps/api/src`)**

- `app.ts` builds the Express app (middleware order matters — read the comments); `server.ts` listens and shuts down gracefully. `pnpm dev` restarts the API on every change (`tsx watch`, including `packages/shared` and `.env.local`).
- `routes/*.routes.ts`: thin HTTP handlers. Mount `requireAuth` then `requireTrustedOrigin` on each router; add `requirePermission(...)` for cross-account endpoints; use `jsonBody` on POST/PATCH. Register routers in `routes/index.ts`.
- `services/*.service.ts`: all application logic and Drizzle queries. Receive the verified user ID as an argument; filter ownership in SQL. Name cross-account functions with an `Any` suffix and call them only behind `requirePermission`.
- `db/schema/<table>.ts` (export from `db/schema/index.ts`), `drizzle/` (committed migrations), `db/index.ts` (shared pool).
- `lib/auth.ts` (Better Auth server), `lib/logger.ts` (pino), `lib/request-context.ts` (AsyncLocalStorage reqId/userId), `middleware/` (auth, origin, body, errors).
- Express 5 forwards rejected promises to the error handler: throw `HttpError` or let Zod throw; never `res.status(500)` by hand.

**Web (`apps/web/src`)**

- `routes/`: TanStack Start file routes. `_auth/` = sign-in/up, `_protected/` = signed-in screens (the layout's `beforeLoad` redirects anonymous visitors). Pages render on the server first, then hydrate; any component may use hooks. `routeTree.gen.ts` is generated and committed.
- `lib/auth-client.ts`: Better Auth browser client pointed at the API origin with `credentials: "include"`.
- `lib/auth.middleware.ts` + `lib/session.ts`: server function middleware that reads the visitor's session from the API by forwarding their cookie; the root route stores it in router context.
- `lib/api/client.ts`: `apiFetch` + `ApiError`. Isomorphic: in the browser it calls `VITE_API_URL` with cookies; during SSR it calls `API_INTERNAL_URL` forwarding the cookie and request ID.
- `features/<feature>/api.ts` (one function per endpoint) → `queries.ts` (query keys + `queryOptions`) → `hooks.ts` (custom hooks: `useX`, `useCreateX`, …). Components use hooks only. Route loaders call `context.queryClient.ensureQueryData(xQuery(...))` so SSR renders data.
- Files ending in `.server.ts` are server-only; TanStack Start import protection fails the build if browser code imports one. Reach them via `createServerFn`, `createMiddleware().server()`, or the `.server()` branch of `createIsomorphicFn` — and keep server-only names out of `.client()` branches, even in types.
- `components/ui`: owned shadcn/ui primitives (`npx shadcn@4.21.0 add <component>` from `apps/web`). `styles/globals.css`: Tailwind v4 tokens. Motion from `motion/react`; respect reduced motion.

**Shared (`packages/shared/src`)**: `validators/` (strict zod input schemas, used by API handlers and typed by web forms), `permissions.ts` (statement, roles, `roleHasPermission`), `types/api.ts` (response DTOs with ISO-string dates), `site.ts` (identity from `starter.config.json`). Keep it free of Node-only or browser-only code.

## Security rules

Authenticate at every API boundary: `requireAuth` answers JSON 401. The web app's layout guard is presentation, not authorization. Filter every user-owned read/update/delete by the verified session's user ID; never trust a submitted owner ID. Validate bodies, IDs, and pagination with strict shared schemas before services run.

The browser calls the API cross-origin with cookies. CORS and Better Auth `trustedOrigins` allow exactly `WEB_URL` (plus `TRUSTED_ORIGINS`). Every cookie-authenticated mutation, including DELETE, must pass `requireTrustedOrigin`. Session cookies reach the web server because both apps share a host locally (cookies ignore ports) and a parent `COOKIE_DOMAIN` in production — keep `BETTER_AUTH_URL`, `WEB_URL`, and `VITE_API_URL` consistent (`pnpm run doctor` checks).

Authorize separately from authentication when a feature reaches past the caller's own rows. Declare the resource and actions in `packages/shared/src/permissions.ts`, guard the API route with `requirePermission`, and guard the page with `roleHasPermission(session.user.role, …)` in `beforeLoad` (throw `notFound()`). Roles come from `user.role`, which signup cannot set; use `pnpm role:set <email> <role>`. Hiding UI is never the access check.

Keep secrets server-side; only `VITE_*` values reach the browser, and `VITE_API_URL` is the only one. Validate new API settings in `apps/api/src/config/env.ts`. Never log cookies, passwords, tokens, or connection strings — the pino loggers redact the common fields; do not log request bodies. Encode IDs placed in API paths with `encodeURIComponent`.

Request bodies are capped at 100 kB, including Better Auth's (`limitAuthBody`). Better Auth rate limits are on outside the API tests; `TRUST_PROXY=true` is refused. The web app sets framing, nosniff, and referrer headers (HSTS in production) in `apps/web/src/start.ts`. Before production, walk through the security checklist in `docs/deployment.md`.

## Adding a resource end to end

Follow the Notes example (`docs/backend.md`, `docs/frontend.md`):

1. Table: `apps/api/src/db/schema/<table>.ts`, export from `index.ts`, `pnpm db:generate`, inspect the SQL, `pnpm db:migrate`. Commit SQL and `drizzle/meta` together. Never rewrite applied migrations or reset to fix errors.
2. Contract: strict zod schemas in `packages/shared/src/validators/<resource>.ts` and DTO types in `packages/shared/src/types/api.ts`; add the subpath to `packages/shared/package.json` `exports`.
3. API: `services/<resource>.service.ts`, `routes/<resource>.routes.ts`, register in `routes/index.ts`; tests in `apps/api/src/test/`.
4. Web: `features/<resource>/{api,queries,hooks}.ts`, components, and a page under `routes/_protected/` with a loader that ensures the query.

Use PostgreSQL `pgTable`/boolean/timestamp-with-time-zone columns and asynchronous queries. Never substitute SQLite syntax or disable TLS verification.

## Verify and hand off

Run `pnpm check` (lint, typecheck, API + root tests on disposable PostgreSQL) and `pnpm build` for substantive changes. For auth/routing/session/CORS changes also run `pnpm test:e2e` (production builds + Playwright). For setup or Compose changes run `pnpm test:setup`. Add tests for real behavior and data isolation. Review the UI at narrow and wide widths when changing layout. Once the app has a real first screen, the starter placeholder (`data-starter-placeholder` in `apps/web/src/routes/_protected/app.tsx`) and `e2e/starter.spec.ts` must be gone; `pnpm run doctor` reminds you while they remain.

Report the result, how to use it, checks run, and any remaining limitation. Keep dashboard-specific, chatbot-specific, billing, and provider-specific features in derivatives unless the user asks to add them to this base. Do not deploy, purchase services, or choose an AI provider just because this is an AI-friendly starter.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
