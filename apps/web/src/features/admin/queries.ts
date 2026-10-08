import { queryOptions } from "@tanstack/react-query";
import type { ListNotesInput } from "@starter/shared/validators/notes";
import { listAnyNotes } from "./api";

export const adminKeys = {
  all: ["admin"] as const,
  notes: (params: ListNotesInput) =>
    [...adminKeys.all, "notes", params] as const,
};

export function adminNotesQuery(
  params: ListNotesInput = { limit: 50, offset: 0 },
) {
  return queryOptions({
    queryKey: adminKeys.notes(params),
    queryFn: ({ signal }) => listAnyNotes(params, signal),
  });
}
