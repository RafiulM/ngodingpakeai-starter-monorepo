// The JSON contract between the API and the web app. Timestamps cross the wire
// as ISO strings, so these are the shapes the browser actually receives.

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
};

export type PageMeta = { limit: number; offset: number; hasMore: boolean };

export type Paginated<T> = { data: T[]; meta: PageMeta };

export type DataResponse<T> = { data: T };

export type NoteDto = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminNoteDto = NoteDto & { ownerName: string; ownerEmail: string };
