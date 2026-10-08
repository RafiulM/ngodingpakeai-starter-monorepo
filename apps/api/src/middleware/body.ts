import express, { type RequestHandler } from "express";
import { HttpError } from "../lib/http-error";

// One size limit for every request body the API accepts.
export const BODY_LIMIT_BYTES = 100 * 1024;

const parseJson = express.json({ limit: BODY_LIMIT_BYTES, strict: true });

// Mount on POST/PATCH routes, after requireAuth and requireTrustedOrigin, so an
// anonymous or cross-site request gets 401/403 before its body is read. Body
// parsing is per-route on purpose: Better Auth needs the raw request stream.
export const jsonBody: RequestHandler = (req, res, next) => {
  const contentType = req
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json")
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send an application/json body.",
    );
  parseJson(req, res, next);
};

// Better Auth reads /api/auth/* bodies itself, with no size limit, so cap them
// here from the headers alone, before anything is buffered. Node stops a body
// at its Content-Length; browsers always send one for fetch bodies, so a
// streamed (chunked) body without it is refused instead of counted.
export const limitAuthBody: RequestHandler = (req, _res, next) => {
  const length = req.get("content-length");
  if (length === undefined && req.get("transfer-encoding") !== undefined)
    throw new HttpError(
      411,
      "LENGTH_REQUIRED",
      "Send the request body with a Content-Length header.",
    );
  if (Number(length) > BODY_LIMIT_BYTES)
    throw new HttpError(
      413,
      "PAYLOAD_TOO_LARGE",
      "The request body is too large.",
    );
  next();
};
