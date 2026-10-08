---
name: build-feature
description: Build or change a feature in this Express + TanStack Start monorepo, including UI, authenticated Express routes, services, shared validators, TanStack Query hooks, and PostgreSQL data while reusing the existing authentication and components.
---

Read `AGENTS.md`, `docs/architecture.md`, `docs/backend.md`, `docs/frontend.md`, and the relevant feature files. On a fresh project, follow the starter-setup skill first, then continue the feature without requiring a separate setup prompt. Infer routine implementation details; clarify product ambiguity only when it changes the outcome. Deliver a usable slice with real behavior, appropriate loading/empty/error states, and readable beginner-facing explanations.

Consult Context7 as described in `AGENTS.md` before relying on library APIs. Inspect installed versions instead of adding a second framework, ORM, auth library, data-fetching library, component system, or motion package.

Work in this order, mirroring Notes:

1. **Schema** — `apps/api/src/db/schema/<table>.ts`, exported from `index.ts`, importing foreign-key tables from sibling files. Keep Better Auth's core tables intact. `pnpm db:generate`, inspect the SQL, `pnpm db:migrate`.
2. **Contract** — strict zod input schemas in `packages/shared/src/validators/<resource>.ts` (reject unknown and owner fields; PATCH requires an editable field) and response DTOs in `packages/shared/src/types/api.ts`. Add the subpath export in `packages/shared/package.json`.
3. **Service** — `apps/api/src/services/<resource>.service.ts` holds every query and rule. Take the verified user ID as a separate argument; filter owned reads/updates/deletes in SQL; assign ownership from that argument on create. Services never read requests, cookies, or build responses.
4. **Routes** — `apps/api/src/routes/<resource>.routes.ts`: `router.use(requireAuth, requireTrustedOrigin)`, `jsonBody` on POST/PATCH, parse params/query/body with the shared schemas, call one service, choose the status (201 + Location, 204 for deletes, identical 404 for absent and unowned rows). Cross-account endpoints add `requirePermission(...)` after declaring the actions in `packages/shared/src/permissions.ts`. Register the router in `routes/index.ts`.
5. **Web data** — `apps/web/src/features/<resource>/api.ts` (typed `apiFetch` calls), `queries.ts` (hierarchical keys + `queryOptions`), `hooks.ts` (`useX` with `useSuspenseQuery`, mutations that update/invalidate the cache; optimistic updates where it helps).
6. **Page** — under `apps/web/src/routes/_protected/` so the session guard applies; the loader calls `context.queryClient.ensureQueryData(...)` so the server render includes data; components use the hooks only. Pages reaching past the user's rows check `roleHasPermission` in `beforeLoad` and throw `notFound()`.

Security details that recur in new features:

- Encode values placed in API paths: `` `/api/<resource>/${encodeURIComponent(id)}` ``.
- A new setting is validated in `apps/api/src/config/env.ts` (messages name the field, never the value) and listed in `.env.example`. Only `VITE_*` values reach the browser, so never give a secret that prefix; add a new `VITE_*` name to the `build` task's `env` in `turbo.json` so cached builds pick it up.
- Endpoints that create rows in bulk, send messages, or call paid or external services need a per-user limit or quota.
- Server code that fetches a URL derived from input must allow-list its hosts and never forward the visitor's cookie to it.

Browser mutations go to the API through hooks; do not add server-function mutation flows that bypass the API. Server-only web code ends in `.server.ts` and is reached only through `createServerFn`, middleware `.server()`, or `createIsomorphicFn().server()`.

Definition of done for the first feature: the signed-in app page no longer carries the starter's blank canvas. Remove the `data-starter-placeholder` section in `apps/web/src/routes/_protected/app.tsx` (and `CopyPrompt` if nothing else needs it), delete `e2e/starter.spec.ts`, and confirm `pnpm run doctor` prints no placeholder reminder. Keep or remove the Notes example deliberately; do not silently delete saved records.

Reuse `apps/web/src/components/ui`, `cn()`, and CSS tokens. Prefer semantic controls, explicit labels, visible focus, and responsive layouts. Use Motion where helpful and preserve `MotionConfig reducedMotion="user"`. Format dates deterministically (e.g. a fixed time zone) so server and browser renders match.

Validate actual behavior: add API tests in `apps/api/src/test/` like `notes.test.ts` (anonymous 401, CRUD persistence, invalid input, cross-account isolation, origin checks) and browser tests in `e2e/` for the main UI flow. Tests run against disposable PostgreSQL through `pnpm test` / `pnpm test:e2e`. Run the applicable checks in `AGENTS.md`, update relevant docs, and explain what the user can now do. Do not describe simulated interactions as working functionality.
