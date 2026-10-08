# Agent entrypoint

Read [AGENTS.md](AGENTS.md) before working. It is the canonical instruction file that supported editors discover automatically; this file is an entrypoint for tools or prompts that ask for `agent.md`.

On a first app-building prompt, read [.agents/skills/starter-setup/SKILL.md](.agents/skills/starter-setup/SKILL.md), prepare the local environment, then continue the requested feature. Users do not need to ask for database setup separately.

Database operations and troubleshooting: [.agents/skills/dev-database/SKILL.md](.agents/skills/dev-database/SKILL.md).

Backend features use Express routes with `requireAuth`, shared zod validators, services for all queries, and separate Drizzle table files ([docs/backend.md](docs/backend.md)). Frontend data goes through `apiFetch`, query options, and custom TanStack Query hooks ([docs/frontend.md](docs/frontend.md)). Follow the Notes example end to end.
