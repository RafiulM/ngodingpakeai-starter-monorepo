import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
  type QueryKey,
} from "@tanstack/react-query";
import type { NoteDto, Paginated } from "@starter/shared/types";
import type {
  ListNotesInput,
  UpdateNoteInput,
} from "@starter/shared/validators/notes";
import { createNote, deleteNote, updateNote } from "./api";
import { noteQuery, notesKeys, notesListQuery } from "./queries";

// Custom hooks are the only way components touch notes data. They keep query
// keys, cache updates, and invalidation in one place.

// Suspends until data is ready. Pair with a route loader that calls
// queryClient.ensureQueryData(notesListQuery(...)) so SSR renders the list.
export function useNotes(params?: ListNotesInput) {
  return useSuspenseQuery(notesListQuery(params));
}

export function useNote(id: string) {
  return useQuery(noteQuery(id));
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

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNoteInput }) =>
      updateNote(id, input),
    onSuccess: (note) => {
      queryClient.setQueryData(notesKeys.detail(note.id), note);
      return queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
    },
  });
}

// Optimistic: the note disappears immediately and comes back if the API
// refuses. Lists refetch afterwards either way, so pages stay consistent.
export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNote,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notesKeys.lists() });
      const previous = queryClient.getQueriesData<Paginated<NoteDto>>({
        queryKey: notesKeys.lists(),
      });
      queryClient.setQueriesData<Paginated<NoteDto>>(
        { queryKey: notesKeys.lists() },
        (page) =>
          page && { ...page, data: page.data.filter((note) => note.id !== id) },
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      for (const [key, data] of context?.previous ?? [])
        queryClient.setQueryData(key as QueryKey, data);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: notesKeys.detail(id) });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notesKeys.lists() }),
  });
}
