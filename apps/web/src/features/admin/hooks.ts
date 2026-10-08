import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { ListNotesInput } from "@starter/shared/validators/notes";
import { notesKeys } from "@/features/notes/queries";
import { deleteAnyNote } from "./api";
import { adminKeys, adminNotesQuery } from "./queries";

export function useAdminNotes(params?: ListNotesInput) {
  return useSuspenseQuery(adminNotesQuery(params));
}

export function useDeleteAnyNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAnyNote,
    // The deleted note may also be in the admin's own Notes cache.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.all }),
        queryClient.invalidateQueries({ queryKey: notesKeys.all }),
      ]),
  });
}
