import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";

function send(
  res: Parameters<RequestHandler>[1],
  status: number,
  error: Record<string, unknown>,
) {
  res.status(status).json({ error });
}

export const notFound: RequestHandler = () => {
  throw new HttpError(404, "NOT_FOUND", "Route not found.");
};

// Body-parser errors carry `type` and `status`.
type ParserError = Error & { type?: string; status?: number };

// The single place errors become HTTP responses. Expected failures map to the
// shared envelope and are logged by the access log at warn. Anything else is
// attached to the response as `res.err`, so pino-http logs it once — with the
// stack, reqId, and request line — and the client gets a generic 500 that never
// includes database errors, connection strings, or private values.
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof HttpError)
    return send(res, error.status, {
      code: error.code,
      message: error.message,
    });

  if (error instanceof ZodError)
    return send(res, 422, {
      code: "VALIDATION_ERROR",
      message: "Check the supplied fields.",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });

  const parserError = error as ParserError;
  if (parserError.type === "entity.parse.failed")
    return send(res, 400, {
      code: "INVALID_JSON",
      message: "Send valid JSON.",
    });
  if (parserError.type === "entity.too.large")
    return send(res, 413, {
      code: "PAYLOAD_TOO_LARGE",
      message: "The request body is too large.",
    });

  res.err = error instanceof Error ? error : new Error(String(error));
  send(res, 500, {
    code: "INTERNAL_ERROR",
    message: "Something went wrong. Try again.",
  });
};
