import { queryOptions } from "@tanstack/react-query";
import type { ListNotesInput } from "@starter/shared/validators/notes";
import { getNote, listNotes } from "./api";

export const NOTES_PAGE_SIZE = 20;

// Hierarchical keys: invalidating notesKeys.lists() refreshes every page,
// notesKeys.all refreshes everything about notes.
export const notesKeys = {
  all: ["notes"] as const,
  lists: () => [...notesKeys.all, "list"] as const,
  list: (params: ListNotesInput) => [...notesKeys.lists(), params] as const,
  details: () => [...notesKeys.all, "detail"] as const,
  detail: (id: string) => [...notesKeys.details(), id] as const,
};

// Shared by route loaders (queryClient.ensureQueryData → SSR prefetch) and
// hooks (useSuspenseQuery → reads the same cache entry on the client).
export function notesListQuery(
  params: ListNotesInput = { limit: NOTES_PAGE_SIZE, offset: 0 },
) {
  return queryOptions({
    queryKey: notesKeys.list(params),
    queryFn: ({ signal }) => listNotes(params, signal),
  });
}

export function noteQuery(id: string) {
  return queryOptions({
    queryKey: notesKeys.detail(id),
    queryFn: ({ signal }) => getNote(id, signal),
  });
}
