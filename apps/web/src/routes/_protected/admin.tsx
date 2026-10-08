import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Trash2 } from "lucide-react";
import { roleHasPermission } from "@starter/shared/permissions";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/features/notes/components/note-form";
import { useAdminNotes, useDeleteAnyNote } from "@/features/admin/hooks";
import { adminNotesQuery } from "@/features/admin/queries";

export const Route = createFileRoute("/_protected/admin")({
  head: () => ({ meta: [{ title: `Admin | ${siteConfig.name}` }] }),
  // Without notes:read-any this renders not-found, so the route stays
  // invisible to accounts that cannot use it. The role comes from the session
  // the root route just read from the API; the API re-checks every request.
  beforeLoad: ({ context }) => {
    if (!roleHasPermission(context.session?.user.role, { notes: ["read-any"] }))
      throw notFound();
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(adminNotesQuery()),
  component: AdminPage,
});

function AdminPage() {
  const { user } = Route.useRouteContext().session;
  const { data: page } = useAdminNotes();
  const remove = useDeleteAnyNote();
  const canDelete = roleHasPermission(user.role, { notes: ["delete-any"] });

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ShieldCheck className="size-4" aria-hidden="true" /> Admin access
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Every account’s notes
      </h1>
      <p className="mt-3 text-lg leading-7 text-muted-foreground">
        {user.name}, your role grants <code>notes: read-any</code>. Regular
        accounts only ever see their own rows.
      </p>

      {remove.error ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {errorMessage(remove.error)}
        </p>
      ) : null}

      {page.data.length === 0 ? (
        <p className="mt-9 rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-muted-foreground">
          No notes yet. Any account’s notes will show up here.
        </p>
      ) : (
        <ul className="mt-9 space-y-3">
          {page.data.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-4 rounded-xl border bg-card px-5 py-4"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{note.title}</p>
                {note.content && (
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {note.content}
                  </p>
                )}
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  {note.ownerName} · {note.ownerEmail}
                </p>
              </div>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${note.title}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(note.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {page.meta.hasMore && (
        <p className="mt-4 text-sm text-muted-foreground">
          Showing the first {page.meta.limit}. Page with{" "}
          <code>?limit=&amp;offset=</code> on <code>/api/admin/notes</code>.
        </p>
      )}

      <div className="mt-8">
        <Button variant="ghost" asChild size="sm">
          <Link to="/app">
            <ArrowLeft aria-hidden="true" />
            Back to your app
          </Link>
        </Button>
      </div>
    </div>
  );
}
