# Backend standard (Express API)

The Notes API is a small, working reference backend. It saves real PostgreSQL rows and uses the existing Better Auth accounts. It has no seeded users, mock sessions, or fabricated responses. Use the same structure for new features.

```text
HTTP request
  → apps/api/src/routes/notes.routes.ts
  → requireAuth (Better Auth session) → requireTrustedOrigin (mutation CSRF check)
  → jsonBody (POST/PATCH: 415 / 400 before the handler)
  → @starter/shared/validators/notes: validate body, params, and query
  → apps/api/src/services/notes.service.ts: domain operations and Drizzle queries
  → apps/api/src/db/schema/notes.ts: PostgreSQL table
```

## Responsibilities

- **Routes** own HTTP: authenticate (router-level middleware), parse/validate, call a service, and choose the response status. They do not query Drizzle or PostgreSQL directly.
- **Services** own application rules and database queries. They receive the verified session's user ID as a separate argument. Every user-owned read, update, and delete filters by it in SQL. Updates/deletes use one scoped statement, avoiding a separate ownership check that could race. Services never accept a request, send a response, or read cookies.
- **Validators** (in `packages/shared`) define allowed input and inferred TypeScript types, shared with the web app. Strict schemas reject unknown fields, including submitted owner IDs. PATCH requires at least one editable field. IDs and query parameters are validated before queries.
- **Schemas** define tables, indexes, defaults, and relationships. Each table has its own file; `db/schema/index.ts` exports them all for Drizzle Kit, the pool, and Better Auth. Table files import dependencies directly from sibling files.
- **Middleware** provides session checks (`requireAuth`, `requirePermission`), the origin check, JSON body handling, private caching, and the single error handler. Better Auth's `/api/auth/*` handler stays delegated to Better Auth and its Drizzle adapter.

```ts
// apps/api/src/routes/notes.routes.ts (excerpt)
export const notesRouter = Router();
notesRouter.use(requireAuth, requireTrustedOrigin);

notesRouter.post("/", jsonBody, async (req, res) => {
  const input = createNoteSchema.parse(req.body);
  const note = await createNote(getAuth(req).user.id, input);
  res.status(201).location(`/api/notes/${note.id}`).json({ data: note });
});
```

Express 5 forwards rejected promises to the error handler: throw `HttpError(status, code, message)` for expected failures and let Zod throw for invalid input. Do not catch-and-respond in handlers.

## Notes endpoints

| Method | Path                           | Result                                            |
| ------ | ------------------------------ | ------------------------------------------------- |
| GET    | `/api/notes?limit=20&offset=0` | 200, current user's notes and pagination metadata |
| POST   | `/api/notes`                   | 201, creates a note and returns a Location header |
| GET    | `/api/notes/:id`               | 200, a single owned note                          |
| PATCH  | `/api/notes/:id`               | 200, changes title and/or content                 |
| DELETE | `/api/notes/:id`               | 204, no response body                             |

All endpoints require the Better Auth session cookie. POST/PATCH accept `Content-Type: application/json`. Every mutation, including DELETE, requires an `Origin` header matching `WEB_URL` (or `TRUSTED_ORIGINS`); browsers send it on cross-origin fetches. Command-line clients must set it explicitly. Requests marked `Sec-Fetch-Site: cross-site` are rejected even with a valid cookie.

Create input: `{ "title": "My first note", "content": "Optional text" }`. Title is trimmed and must contain 1–160 characters; content is at most 10,000 characters and defaults to an empty string. IDs are UUIDs. List `limit` is 1–100 (default 20); `offset` is 0–1,000,000 (default 0). Results sort newest first, then by ID.

Single-item responses wrap a note in `data`. Each note contains `id`, `title`, `content`, `createdAt`, and `updatedAt` (ISO strings). Lists return `{ "data": [...], "meta": { "limit", "offset", "hasMore" } }`. Owner IDs and auth records are not part of these responses. The shapes are typed in `packages/shared/src/types/api.ts`.

Errors use `{ "error": { "code": "...", "message": "..." } }`, with field `details` for validation errors. Statuses: 400 malformed JSON, 401 missing/invalid session, 403 rejected origin or missing permission, 404 missing or unowned record (identical responses), 411 streamed body without `Content-Length` (`/api/auth/*`), 413 body over 100 kB (application routes and `/api/auth/*`), 415 unsupported content type, 422 invalid input, 500 unexpected failure. Database exceptions and private values are never returned. Application responses use `Cache-Control: private, no-store` and carry an `X-Request-Id`.

## Cross-origin rules

The web app and API are different origins. The API allows exactly the trusted origins:

- `cors({ origin: trustedOrigins, credentials: true })` — browsers on other origins cannot read responses.
- Better Auth `trustedOrigins` — its own endpoints reject other origins.
- `requireTrustedOrigin` — application mutations reject other origins.

`trustedOrigins` is `WEB_URL` plus the optional comma-separated `TRUSTED_ORIGINS`.

## Role-based access

Ownership answers "is this row mine?". Roles answer "may this account reach past its own rows?". The starter uses the Better Auth admin plugin with a shared access-control statement.

```text
packages/shared/src/permissions.ts   statement (resources → actions), roles, roleHasPermission()
apps/api/src/lib/auth.ts             admin({ ac, roles, defaultRole, adminRoles })
apps/api/src/middleware/auth.ts      requirePermission(permissions) for routes
apps/web/src/lib/auth-client.ts      adminClient({ ac, roles }) for UI-only checks
apps/web/src/routes/_protected/admin.tsx  beforeLoad: roleHasPermission → notFound()
```

```ts
export const statement = {
  ...defaultStatements, // Better Auth's own user and session management
  notes: ["read-any", "delete-any"],
} as const;

export const roles = {
  user: ac.newRole({ notes: [] }),
  admin: ac.newRole({
    ...adminAc.statements,
    notes: ["read-any", "delete-any"],
  }),
};
```

Roles live in `user.role` as a string; a comma-separated list such as `admin,support` grants the union. Signup cannot set it, so an account can never promote itself. Grant a role to an existing account:

```sh
pnpm role:set someone@example.com admin
```

Guard the API route — 401 without a session, 403 without the permission, both before a service runs:

```ts
adminRouter.use(requireAuth, requireTrustedOrigin);
adminRouter.get(
  "/notes",
  requirePermission({ notes: ["read-any"] }),
  async (req, res) => {
    res.json(await listAnyNotes(listNotesSchema.parse(req.query)));
  },
);
```

`requirePermission` asks Better Auth, which reads the stored role, so revoking a role takes effect on the next request. Cross-account service functions carry an `Any` suffix (`listAnyNotes`, `deleteAnyNote`) because they deliberately skip the ownership filter; call them only behind `requirePermission`.

| Method | Path                   | Permission         | Result                                                   |
| ------ | ---------------------- | ------------------ | -------------------------------------------------------- |
| GET    | `/api/admin/notes`     | `notes:read-any`   | 200, every account's notes plus `ownerName`/`ownerEmail` |
| DELETE | `/api/admin/notes/:id` | `notes:delete-any` | 204, deletes any account's note                          |

The admin plugin also adds `banned`, `banReason`, `banExpires`, `session.impersonatedBy`, and its own `/api/auth/admin/*` endpoints, guarded by the `user` and `session` actions that only `admin` holds here. Those actions reach every account: an `admin` can list, create, ban, and delete users, impersonate them, set their passwords and emails, revoke their sessions, and change roles — including granting `admin`. Grant it only to people trusted with all of that. For someone who only moderates content, declare a narrower role with your resource's actions alone:

```ts
moderator: ac.newRole({ notes: ["read-any", "delete-any"] }),
```

## Try it from a terminal

```sh
curl -c jar -b jar -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"name":"Me","email":"me@example.com","password":"a-long-password"}' \
  http://localhost:4000/api/auth/sign-up/email
curl -b jar -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"title":"My first note"}' http://localhost:4000/api/notes
curl -b jar http://localhost:4000/api/notes
```

## Extend it

1. Create a table file under `apps/api/src/db/schema/` and export it from `index.ts`. Leave auth table names and fields unchanged.
2. Define strict input schemas in `packages/shared/src/validators/` and response types in `packages/shared/src/types/api.ts`; add the subpath to the package's `exports`.
3. Add `apps/api/src/services/<resource>.service.ts` with all queries. Require the authenticated user ID for user-owned operations.
4. Add `apps/api/src/routes/<resource>.routes.ts` with `requireAuth` + `requireTrustedOrigin` (and `requirePermission` for cross-account endpoints), then register it in `routes/index.ts`.
5. `pnpm db:generate`, inspect the SQL, `pnpm db:migrate`. Keep SQL and metadata together; never edit applied migrations.
6. Add tests in `apps/api/src/test/` for CRUD, rejected input, anonymous access, origin checks, and cross-account isolation; then build the web side ([frontend](frontend.md)). Run `pnpm check`.

Notes is replaceable example functionality. If removing it from a project that has already migrated, remove its routes, service, validator, web feature, and schema export, and generate a new reviewed migration. Do not rewrite historical migrations or drop saved notes without authorization.
