import { Router } from "express";
import {
  listNotesSchema,
  noteIdSchema,
} from "@starter/shared/validators/notes";
import { HttpError } from "../lib/http-error";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireTrustedOrigin } from "../middleware/origin";
import { deleteAnyNote, listAnyNotes } from "../services/notes.service";

// Cross-account endpoints. Order matters: 401 without a session, 403 for an
// untrusted origin, then 403 without the permission — all before a service runs.
export const adminRouter = Router();

adminRouter.use(requireAuth, requireTrustedOrigin);

adminRouter.get(
  "/notes",
  requirePermission({ notes: ["read-any"] }),
  async (req, res) => {
    const query = listNotesSchema.parse(req.query);
    res.json(await listAnyNotes(query));
  },
);

adminRouter.delete(
  "/notes/:id",
  requirePermission({ notes: ["delete-any"] }),
  async (req, res) => {
    const id = noteIdSchema.parse(req.params.id);
    if (!(await deleteAnyNote(id)))
      throw new HttpError(404, "NOT_FOUND", "Note not found.");
    res.status(204).end();
  },
);
