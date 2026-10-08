import { useState, type FormEvent } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import type { NoteDto } from "@starter/shared/types";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Values = { title: string; content: string };

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const field = error.details?.[0];
    return field?.field ? `${field.field}: ${field.message}` : error.message;
  }
  return "Something went wrong. Try again.";
}

// Used for both creating and editing. The parent supplies the mutation; this
// component only owns the fields.
export function NoteForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
  idPrefix,
}: {
  initial?: Pick<NoteDto, "title" | "content">;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: Values) => Promise<unknown>;
  onCancel?: () => void;
  idPrefix: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    try {
      await onSubmit({ title: title.trim(), content });
      if (!initial) {
        setTitle("");
        setContent("");
      }
    } catch {
      // The mutation's error state renders below.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={pending}>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={160}
          placeholder="What's on your mind?"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-content`}>Details</Label>
        <Textarea
          id={`${idPrefix}-content`}
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={10_000}
          rows={3}
          placeholder="Optional"
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
        >
          {errorMessage(error)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !title.trim()}>
          {pending ? (
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : initial ? null : (
            <Plus aria-hidden="true" />
          )}
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
