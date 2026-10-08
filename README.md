# Express TanStack Postgres — ngodingpakeai starters

A monorepo starter with an **Express 5 API** and a **TanStack Start web app**, sharing one TypeScript contract:

- **API** (`apps/api`): Express 5 + TypeScript, Better Auth, Drizzle ORM, PostgreSQL, simple role-based access, routes → services, structured pino logging, hot restart.
- **Web** (`apps/web`): TanStack Start (Vite + Nitro), Better Auth client, an SSR auth middleware, TanStack Query custom hooks, Tailwind CSS v4, shadcn/ui, Motion.
- **Shared** (`packages/shared`): zod validators, permissions, API types, app identity.

It includes working accounts, a blank protected app page, a Notes feature that shows the full path from Express route to React hook, an admin page guarded by roles, project skills, and Context7 configuration.

## Start here

Install **Node.js 22.12 or newer** and **Docker Desktop**, then start Docker Desktop. Run `corepack enable` once if you don't have pnpm. Open this project folder in your AI editor and prompt:

> Build a personal reading list with accounts. Set up this project, run it, and let each person manage their own books.

The agent instructions make local setup part of the first app-building prompt, then continue your feature. See [the first-run workflow](docs/local-development.md).

Or run inside this folder:

```sh
pnpm run setup
pnpm dev
```

Type `pnpm run setup` and `pnpm run doctor` in full: `pnpm setup` and `pnpm doctor` are pnpm's own built-in commands and do something else.

Open [localhost:3000](http://localhost:3000); it sends you to sign-in, where you create your own account. The API answers on [localhost:4000](http://localhost:4000/api/health).

Setup installs pinned dependencies, generates a private auth secret, the two app origins, and a database password, starts PostgreSQL 17 through `compose.dev.yaml` in Docker, waits for it to be healthy, applies migrations, and checks everything. Values live in the ignored root `.env.local`, shared by both apps; repeated setup preserves existing values and database records.

The database is published only on loopback, on a free high port recorded in `.env.local`, with data in a named Docker volume. `pnpm db:down` stops it while keeping data; `pnpm db:up` starts it again.

## Already have PostgreSQL?

Set a connection string in `.env.local` **before** running setup:

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/database
```

A supplied connection bypasses Docker and migrations target that database. Use a database dedicated to this app and follow your provider's TLS requirements. With separate pooled and direct connections, use the pooled URL for `DATABASE_URL` and the direct URL for `MIGRATION_DATABASE_URL`.

## How the pieces fit

```text
Browser ──cookies + Origin──▶ Express API :4000 ── routes → services → Drizzle → PostgreSQL
   ▲                              ▲
   └── HTML + data ── Web :3000 ──┘ SSR: forwards the visitor's cookie and X-Request-Id
```

- The browser signs in with Better Auth on the API (a different origin) using `credentials: "include"`. CORS and Better Auth's `trustedOrigins` allow exactly the web app's origin, and every cookie-authenticated mutation must come from it.
- The web server reads the session from the API in a TanStack Start **auth middleware** and prefetches page data into **TanStack Query**, so pages render with data; the browser then uses **custom hooks** (`useNotes`, `useCreateNote`, …).
- Locally both apps share the session cookie because cookies ignore ports. In production put them on subdomains (`app.example.com`, `api.example.com`) and set `COOKIE_DOMAIN=.example.com`.

Read [architecture](docs/architecture.md), the [backend standard](docs/backend.md), and the [frontend standard](docs/frontend.md).

## Build with a prompt

Enable Context7 once in your editor; see [AI editor setup](docs/ai-workflow.md). Then try:

> Read AGENTS.md and use build-feature. Create a personal reading list. Let me add books, mark them finished, and delete them. Each account should only see its own books. Follow the Notes example from Express route to React hook, and use Context7 for current documentation. Build the smallest working version and test it.

More in [prompts](docs/prompts.md). No model API key is required by the app.

## What is included

| Area           | Included                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------ |
| Monorepo       | pnpm workspaces + catalog, Turborepo, shared TypeScript contract package                   |
| API            | Express 5, routes → services, zod validation, JSON error envelope, helmet, CORS            |
| Data           | Drizzle ORM, node-postgres pool, committed PostgreSQL migrations                           |
| Accounts       | Better Auth email/password on the API; browser client + SSR auth middleware on the web app |
| Roles          | Better Auth access control shared by both apps; permission-guarded routes and admin page   |
| Web data       | Isomorphic `apiFetch`, query options, custom TanStack Query hooks, SSR prefetch/hydration  |
| Logging        | pino on both servers, request IDs across services, AsyncLocalStorage context, redaction    |
| Dev loop       | API restarts on change (tsx watch, graceful shutdown), Vite HMR, one `pnpm dev`            |
| Local database | PostgreSQL 17 in Docker, persistent volume, random credentials, healthcheck                |
| UI             | Tailwind v4, shadcn/ui primitives, Lucide icons, Motion with reduced motion                |
| AI workflow    | AGENTS.md + agent.md, four project skills, Context7 configs for four editors               |
| Quality        | Lint, types, API integration tests, browser tests, all on disposable PostgreSQL; CI        |
| Deployment     | Per-app Dockerfiles (turbo prune), self-contained API bundle, migrator image               |

## Commands

| Command                         | What it does                                                           |
| ------------------------------- | ---------------------------------------------------------------------- |
| `pnpm run setup`                | Install, configure, start local PostgreSQL if needed, migrate, check   |
| `pnpm dev`                      | Prepare the database and start the API and web app                     |
| `pnpm dev:api` / `pnpm dev:web` | Start one app                                                          |
| `pnpm db:up` / `db:down`        | Start / stop this copy's local PostgreSQL (data kept)                  |
| `pnpm db:status` / `db:logs`    | Inspect the database container                                         |
| `pnpm db:generate`              | Generate migration SQL after a schema edit                             |
| `pnpm db:migrate`               | Apply committed migrations                                             |
| `pnpm db:studio`                | Inspect the database with Drizzle Studio                               |
| `pnpm role:set <email> <role>`  | Grant a role, e.g. `pnpm role:set you@example.com admin`               |
| `pnpm run doctor`               | Check settings, origins, cookie rules, database, tables, and AI files  |
| `pnpm check`                    | Lint, typecheck, and tests against disposable PostgreSQL               |
| `pnpm test`                     | API integration tests + setup, copier, and migration tests             |
| `pnpm test:e2e`                 | Build both apps and run browser tests against disposable PostgreSQL    |
| `pnpm test:setup`               | Verify fresh setup, retries, and data persistence in a disposable copy |
| `pnpm build` / `pnpm start`     | Build and serve both production apps                                   |
| `pnpm format`                   | Format source and docs                                                 |

Tests require Docker even if your app uses a hosted database: they launch a unique disposable PostgreSQL server and remove it afterward. Browser tests run the production builds on ports **4101** (API) and **3101** (web); run `pnpm exec playwright install chromium` once.

## Customize and extend

- Identity: `starter.config.json` (shared by both apps through `@starter/shared/site`).
- Your first feature: replace the placeholder in `apps/web/src/routes/_protected/app.tsx`. `pnpm run doctor` reminds you until it is gone.
- Tables: `apps/api/src/db/schema/` (export from `index.ts`).
- Roles: `packages/shared/src/permissions.ts`.
- UI tokens: `apps/web/src/styles/globals.css`. Add primitives from `apps/web`: `npx shadcn@4.21.0 add dialog`.
- Derivative: `pnpm create:variant dashboard ../my-dashboard` ([derivatives](docs/derivatives.md)).

## Hosting

Run the API and web app as two Node.js services on subdomains of one site, with a persistent PostgreSQL service. Apply migrations once per release. See [deployment](docs/deployment.md) for environment variables, cookie domains, proxies, Docker images, and the pre-launch security checklist:

```sh
docker build -f apps/api/Dockerfile -t my-api .
docker build -f apps/api/Dockerfile --target migrator -t my-api-migrate .
docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t my-web .
```

Email verification, password recovery email, social login, billing, and AI provider calls are not configured. Add only the services your product needs.

## Troubleshooting

- **Docker not found / cannot connect:** install and start Docker Desktop, then run setup again.
- **Signed in, but pages show you signed out:** both apps must use the same host (`localhost`, not one `127.0.0.1`) locally, or share `COOKIE_DOMAIN` in production. Run `pnpm run doctor`.
- **CORS error or 403 `FORBIDDEN_ORIGIN`:** `WEB_URL` must be the exact origin in your address bar, and `VITE_API_URL` must equal `BETTER_AUTH_URL`.
- **Port in use:** change `WEB_URL` or `BETTER_AUTH_URL` (and `VITE_API_URL`) in `.env.local`; the dev servers follow them.
- **Your saved database port is occupied:** update both `POSTGRES_PORT` and the port inside `DATABASE_URL`, then `pnpm db:up`.
- **Database password rejected:** changing `POSTGRES_PASSWORD` does not change the password inside an existing volume. Restore the original value; do not delete the volume.
- **Missing tables:** run `pnpm db:migrate`.
- **Something failed:** find the request's `reqId` in the terminal (or the `X-Request-Id` response header) and look for the same ID in the API and web logs.

MIT. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
