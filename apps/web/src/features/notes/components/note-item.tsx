import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { NoteDto } from "@starter/shared/types";
import { Button } from "@/components/ui/button";
import { useDeleteNote, useUpdateNote } from "../hooks";
import { errorMessage, NoteForm } from "./note-form";

// UTC keeps the server render and the browser hydration identical.
const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function NoteItem({ note }: { note: NoteDto }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateNote();
  const remove = useDeleteNote();

  if (editing)
    return (
      <li className="rounded-xl border bg-card px-5 py-4">
        <NoteForm
          idPrefix={`edit-${note.id}`}
          initial={note}
          submitLabel="Save changes"
          pending={update.isPending}
          error={update.error}
          onSubmit={async (input) => {
            await update.mutateAsync({ id: note.id, input });
            setEditing(false);
          }}
          onCancel={() => {
            update.reset();
            setEditing(false);
          }}
        />
      </li>
    );

  return (
    <li className="rounded-xl border bg-card px-5 py-4" data-testid="note">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium break-words">{note.title}</p>
          {note.content && (
            <p className="mt-1 text-sm leading-6 whitespace-pre-line break-words text-muted-foreground">
              {note.content}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {dateFormat.format(new Date(note.createdAt))}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${note.title}`}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${note.title}`}
            disabled={remove.isPending}
            onClick={() => remove.mutate(note.id)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      {remove.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage(remove.error)}
        </p>
      ) : null}
    </li>
  );
}
