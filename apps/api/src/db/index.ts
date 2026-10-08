import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env";
import { SqlLogger } from "../lib/db-logger";
import { logger } from "../lib/logger";
import * as schema from "./schema";

// One pool per process. `pnpm dev` restarts the process on change, and
// server.ts ends the pool on shutdown, so reloads never leak connections.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  logger.error(
    { err, module: "db" },
    "An idle PostgreSQL connection was lost. Check database availability.",
  );
});

export const db = drizzle(pool, {
  schema,
  logger: env.LOG_SQL ? new SqlLogger() : false,
});

export async function checkDatabase() {
  await pool.query("SELECT 1");
}
