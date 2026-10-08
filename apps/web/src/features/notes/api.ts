import type { DataResponse, NoteDto, Paginated } from "@starter/shared/types";
import type {
  CreateNoteInput,
  ListNotesInput,
  UpdateNoteInput,
} from "@starter/shared/validators/notes";
import { apiFetch } from "@/lib/api/client";

// One function per endpoint, typed with the shared contract. Components never
// call these directly: they use the hooks in ./hooks.ts.

export function listNotes(params: ListNotesInput, signal?: AbortSignal) {
  return apiFetch<Paginated<NoteDto>>("/api/notes", { query: params, signal });
}

export async function getNote(id: string, signal?: AbortSignal) {
  const { data } = await apiFetch<DataResponse<NoteDto>>(
    `/api/notes/${encodeURIComponent(id)}`,
    {
      signal,
    },
  );
  return data;
}

export async function createNote(input: CreateNoteInput) {
  const { data } = await apiFetch<DataResponse<NoteDto>>("/api/notes", {
    method: "POST",
    body: input,
  });
  return data;
}

export async function updateNote(id: string, input: UpdateNoteInput) {
  const { data } = await apiFetch<DataResponse<NoteDto>>(
    `/api/notes/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: input,
    },
  );
  return data;
}

export function deleteNote(id: string) {
  return apiFetch<void>(`/api/notes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
