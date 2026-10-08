import {
  createFileRoute,
  Link,
  stripSearchParams,
} from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { NoteForm } from "@/features/notes/components/note-form";
import { NoteItem } from "@/features/notes/components/note-item";
import { useCreateNote, useNotes } from "@/features/notes/hooks";
import { NOTES_PAGE_SIZE, notesListQuery } from "@/features/notes/queries";

// The reference feature: Express route → service → shared contract → API
// client → query options → custom hooks → this page.
const searchSchema = z.object({
  offset: z.coerce.number().int().min(0).max(1_000_000).catch(0).default(0),
});

export const Route = createFileRoute("/_protected/notes")({
  head: () => ({ meta: [{ title: `Notes | ${siteConfig.name}` }] }),
  validateSearch: searchSchema,
  // Keep /notes clean: the first page needs no ?offset=0.
  search: { middlewares: [stripSearchParams({ offset: 0 })] },
  loaderDeps: ({ search }) => ({ offset: search.offset }),
  // Runs on the server for the first render (forwarding the visitor's cookie
  // to the API), and on the client for later navigations. useNotes() below
  // then reads the same cache entry, so the list is in the SSR HTML.
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      notesListQuery({ limit: NOTES_PAGE_SIZE, offset: deps.offset }),
    ),
  component: NotesPage,
});

function NotesPage() {
  const { offset } = Route.useSearch();
  const { data: page } = useNotes({ limit: NOTES_PAGE_SIZE, offset });
  const create = useCreateNote();

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <NotebookPen className="size-4" aria-hidden="true" /> Example feature
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Notes
      </h1>
      <p className="mt-3 text-lg leading-7 text-muted-foreground">
        Saved in PostgreSQL through the Express API. Only you can see yours.
      </p>

      <section
        aria-labelledby="new-note"
        className="mt-9 rounded-2xl border bg-card px-6 py-6"
      >
        <h2 id="new-note" className="mb-4 text-lg font-semibold">
          New note
        </h2>
        <NoteForm
          idPrefix="new-note"
          submitLabel="Add note"
          pending={create.isPending}
          error={create.error}
          onSubmit={(input) => create.mutateAsync(input)}
        />
      </section>

      <section aria-labelledby="your-notes" className="mt-9">
        <h2 id="your-notes" className="sr-only">
          Your notes
        </h2>
        {page.data.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-muted-foreground">
            {offset === 0
              ? "No notes yet. Add your first one above."
              : "Nothing on this page."}
          </p>
        ) : (
          <ul className="space-y-3">
            {page.data.map((note) => (
              <NoteItem key={note.id} note={note} />
            ))}
          </ul>
        )}

        {(offset > 0 || page.meta.hasMore) && (
          <nav
            aria-label="Pagination"
            className="mt-6 flex items-center justify-between"
          >
            <Button variant="outline" size="sm" asChild disabled={offset === 0}>
              <Link
                to="/notes"
                search={{ offset: Math.max(0, offset - NOTES_PAGE_SIZE) }}
                disabled={offset === 0}
              >
                <ChevronLeft aria-hidden="true" /> Newer
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={!page.meta.hasMore}
            >
              <Link
                to="/notes"
                search={{ offset: offset + NOTES_PAGE_SIZE }}
                disabled={!page.meta.hasMore}
              >
                Older <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          </nav>
        )}
      </section>
    </div>
  );
}
