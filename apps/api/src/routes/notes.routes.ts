import { Router } from "express";
import {
  createNoteSchema,
  listNotesSchema,
  noteIdSchema,
  updateNoteSchema,
} from "@starter/shared/validators/notes";
import { HttpError } from "../lib/http-error";
import { getAuth, requireAuth } from "../middleware/auth";
import { jsonBody } from "../middleware/body";
import { requireTrustedOrigin } from "../middleware/origin";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from "../services/notes.service";

// Routes own HTTP: authenticate, validate, call one service, pick the status.
// Services own rules and SQL. Ownership always comes from the verified session.
export const notesRouter = Router();

notesRouter.use(requireAuth, requireTrustedOrigin);

notesRouter.get("/", async (req, res) => {
  const query = listNotesSchema.parse(req.query);
  res.json(await listNotes(getAuth(req).user.id, query));
});

notesRouter.post("/", jsonBody, async (req, res) => {
  const input = createNoteSchema.parse(req.body);
  const note = await createNote(getAuth(req).user.id, input);
  res.status(201).location(`/api/notes/${note.id}`).json({ data: note });
});

notesRouter.get("/:id", async (req, res) => {
  const id = noteIdSchema.parse(req.params.id);
  const note = await getNote(getAuth(req).user.id, id);
  if (!note) throw new HttpError(404, "NOT_FOUND", "Note not found.");
  res.json({ data: note });
});

notesRouter.patch("/:id", jsonBody, async (req, res) => {
  const id = noteIdSchema.parse(req.params.id);
  const input = updateNoteSchema.parse(req.body);
  const note = await updateNote(getAuth(req).user.id, id, input);
  if (!note) throw new HttpError(404, "NOT_FOUND", "Note not found.");
  res.json({ data: note });
});

notesRouter.delete("/:id", async (req, res) => {
  const id = noteIdSchema.parse(req.params.id);
  if (!(await deleteNote(getAuth(req).user.id, id)))
    throw new HttpError(404, "NOT_FOUND", "Note not found.");
  res.status(204).end();
});
