import type { AdminNoteDto, Paginated } from "@starter/shared/types";
import type { ListNotesInput } from "@starter/shared/validators/notes";
import { apiFetch } from "@/lib/api/client";

// Cross-account endpoints. The API answers 403 unless the caller's stored role
// grants the permission; the web app's role check only decides what to show.

export function listAnyNotes(params: ListNotesInput, signal?: AbortSignal) {
  return apiFetch<Paginated<AdminNoteDto>>("/api/admin/notes", {
    query: params,
    signal,
  });
}

export function deleteAnyNote(id: string) {
  return apiFetch<void>(`/api/admin/notes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
