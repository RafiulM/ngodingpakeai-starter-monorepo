# Frontend standard (TanStack Start web app)

The web app has no database or auth server of its own. It renders pages, talks to the Express API, and keeps API data in TanStack Query. The Notes page is the reference.

```text
component
  → custom hook            features/notes/hooks.ts      useNotes, useCreateNote, …
  → query options / keys   features/notes/queries.ts    notesKeys, notesListQuery
  → endpoint function      features/notes/api.ts        listNotes, createNote, …
  → apiFetch               lib/api/client.ts            base URL, cookies, ApiError
  → Express API
```

## Authentication

- **Browser client** — `lib/auth-client.ts` creates the Better Auth client for `VITE_API_URL` with `credentials: "include"` and the admin plugin (sharing `@starter/shared/permissions`). Sign-in, sign-up, and sign-out forms call it directly, then `router.invalidate()` re-runs the route guards.
- **Server middleware** — `lib/auth.middleware.ts` defines `authMiddleware`, a TanStack Start server function middleware. On the web server it reads the visitor's session from the API by forwarding their cookie (`lib/session.server.ts`) and puts it on `context.session`. `requireAuthMiddleware` additionally rejects anonymous calls — attach it to any server function you add that must not run signed out.
- **Session in routes** — `routes/__root.tsx` calls `getSessionFn()` in `beforeLoad` and shares `{ session }` as router context. `_protected.tsx` redirects to `/sign-in` without one; `_auth.tsx` redirects signed-in visitors to `/app`.
- **Roles in the UI** — `roleHasPermission(session.user.role, { notes: ["read-any"] })` from `@starter/shared/permissions` hides links and, in a page's `beforeLoad`, throws `notFound()`. The API re-checks every request; never treat a UI check as authorization.

The session cookie belongs to the API host. The web server receives it because cookies ignore ports (`localhost`) or because production sets `COOKIE_DOMAIN` to a parent domain of both apps.

## Calling the API

`apiFetch<T>(path, { method, query, body, signal })` is isomorphic (`createIsomorphicFn`):

- **In the browser** it calls `VITE_API_URL` with `credentials: "include"`; the browser adds the `Origin` header the API's CSRF check requires.
- **On the web server** (route loaders during SSR) it calls `API_INTERNAL_URL` (or `VITE_API_URL`), forwarding the visitor's `cookie` and the request's `X-Request-Id`, and logs upstream failures.

Non-2xx responses throw `ApiError(status, code, message, details)` built from the API's error envelope; network failures throw `ApiError(0, "NETWORK_ERROR", …)`. 204 resolves to `undefined`. Only GETs run on the server; mutations come from the browser.

## Query options and keys

```ts
export const notesKeys = {
  all: ["notes"] as const,
  lists: () => [...notesKeys.all, "list"] as const,
  list: (params: ListNotesInput) => [...notesKeys.lists(), params] as const,
  detail: (id: string) => [...notesKeys.all, "detail", id] as const,
};

export function notesListQuery(params = { limit: 20, offset: 0 }) {
  return queryOptions({
    queryKey: notesKeys.list(params),
    queryFn: ({ signal }) => listNotes(params, signal),
  });
}
```

Hierarchical keys make invalidation precise: `notesKeys.lists()` refreshes every page of the list; `notesKeys.all` refreshes everything about notes.

## Custom hooks

Components never call `apiFetch` or `useQuery` directly; they use the feature's hooks, which own cache updates:

```ts
export function useNotes(params?: ListNotesInput) {
  return useSuspenseQuery(notesListQuery(params));
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createNote,
    onSuccess: (note) => {
      queryClient.setQueryData(notesKeys.detail(note.id), note);
      return queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
    },
  });
}
```

`useDeleteNote` shows an optimistic update: it removes the note from every cached page immediately, restores the snapshot if the API refuses, and refetches afterwards. Mutation errors are `ApiError`s; `errorMessage()` in `note-form.tsx` turns them (including field `details`) into readable text.

## Server rendering with data

```ts
export const Route = createFileRoute("/_protected/notes")({
  validateSearch: z.object({
    offset: z.coerce.number().int().min(0).max(1_000_000).catch(0).default(0),
  }),
  loaderDeps: ({ search }) => ({ offset: search.offset }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      notesListQuery({ limit: 20, offset: deps.offset }),
    ),
  component: NotesPage, // calls useNotes({ limit: 20, offset })
});
```

`router.tsx` creates a fresh `QueryClient` per request and calls `setupRouterSsrQueryIntegration`, which provides the `QueryClientProvider` and dehydrates queries fetched during SSR. The loader fills the cache on the server, the HTML includes the list, and the browser hydrates the same cache entry instead of fetching again. Client-side navigations run the loader in the browser. Queries are fresh for 30 seconds; 4xx `ApiError`s are not retried.

## Server-only code

Files ending in `.server.ts` (`session.server.ts`, `logger.server.ts`, `api/upstream.server.ts`, `request-context.server.ts`) never reach the browser; TanStack Start's import protection fails the build if browser code imports one. Use them only inside `createServerFn` handlers, middleware `.server()` callbacks, or `createIsomorphicFn().server()` — and keep their names out of `.client()` branches, even in type positions (`typeof x` keeps the import alive).

`src/start.ts` registers request middleware: browser security headers (CSP `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, and HSTS in production; a route that sets one keeps its own value), Start's CSRF check for server functions (a custom `start.ts` must add it back explicitly), and the access logger that assigns `X-Request-Id`. The CSP does not restrict scripts: Start renders inline scripts, so a `script-src` policy needs per-request nonces — add one deliberately if your app needs it.

## Add a feature's UI

1. `features/<resource>/api.ts`: one typed function per endpoint using `@starter/shared` types. Encode values placed in a path (`` `/api/notes/${encodeURIComponent(id)}` ``): during SSR the call carries the visitor's cookie, and an unencoded `../` from a URL parameter would reach a different API route.
2. `features/<resource>/queries.ts`: keys and `queryOptions`.
3. `features/<resource>/hooks.ts`: `useX` (suspense), mutations with cache updates.
4. Components under `features/<resource>/components/`, reusing `components/ui`.
5. A page under `routes/_protected/` whose loader ensures the query; `roleHasPermission` in `beforeLoad` for cross-account pages.
6. A Playwright test in `e2e/` for the main flow, then `pnpm test:e2e`.
