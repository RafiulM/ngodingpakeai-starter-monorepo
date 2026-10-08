import { Router } from "express";
import { checkDatabase } from "../db";
import { logger } from "../lib/logger";

export const healthRouter = Router();

// Liveness: the process answers. Does not touch the database, so an outage
// there never makes an orchestrator restart a healthy process.
healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

// Readiness: the database answers too.
healthRouter.get("/ready", async (_req, res) => {
  try {
    await checkDatabase();
    res.json({ status: "ok", database: "ok" });
  } catch (err) {
    logger.warn({ err }, "Readiness check: PostgreSQL is unreachable");
    res.status(503).json({ status: "unavailable", database: "unreachable" });
  }
});
