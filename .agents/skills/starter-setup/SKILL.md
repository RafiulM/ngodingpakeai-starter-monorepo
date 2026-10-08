---
name: starter-setup
description: Prepare this Express + TanStack Start + PostgreSQL monorepo on the first app-building prompt, or fix first-run dependency, Docker, environment, and migration problems so the user can build immediately.
---

Read `README.md`, `package.json`, and the first-prompt workflow in `AGENTS.md`. Setup is part of a request to build or run the app, even when the user never mentions databases. Keep their requested feature as the objective; continue implementing it after setup.

1. If dependencies are absent, run `pnpm run setup` from the repository root. It checks Node.js and pnpm, installs the lockfile, generates missing secrets, origins, and a database port in `.env.local`, starts PostgreSQL using `compose.dev.yaml`, waits for health, migrates, and runs diagnostics. If pnpm is missing, `corepack enable` (bundled with Node.js) provides the pinned version. Do not ask users to copy environment files, invent passwords, create tables, or choose a hosting provider for local development.
2. With dependencies installed, run `pnpm dev:prepare` followed by `pnpm run doctor`. This handles both a new environment and a stopped existing container without reinstalling packages. Preserve private settings, migrations, and database records.
3. Start `pnpm dev` in a persistent terminal if it is not already running. It runs the API and the web app together (Turborepo); the API restarts on file changes and the web app hot-reloads. Verify `BETTER_AUTH_URL/api/health` and `WEB_URL` respond. Each dev server takes its port from its URL, so to move the web app set `WEB_URL=http://localhost:3001` (and keep the API's CORS in sync automatically). Do not run a duplicate server or report an unverified URL.
4. Continue the requested feature using `build-feature`. Report the working preview and any exact remaining user action in plain language.

Read `.agents/skills/dev-database/SKILL.md` when Docker or the database fails. Starting an existing local Docker installation can be handled by the agent when permitted; installing prerequisites or unlocking a desktop app may require the user's action. Do not repeat an unchanged failed command.

An existing `DATABASE_URL` bypasses Docker. Migrations use `MIGRATION_DATABASE_URL` when supplied. Never overwrite a user's supplied connection, print credentials, or substitute SQLite. See `docs/deployment.md` for hosted connections, TLS, and cookie domains.

Use Context7 per `AGENTS.md` for library/tool behavior. Editor activation is separate from app setup: see `docs/ai-workflow.md`. A missing MCP connection does not block local startup; confirm a real documentation-tool response before claiming it works.
