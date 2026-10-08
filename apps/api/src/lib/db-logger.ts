import type { Logger as DrizzleLogger } from "drizzle-orm/logger";
import { logger } from "./logger";

const dbLog = logger.child({ module: "db" });

// Enabled with LOG_SQL=true. Parameters are omitted: they hold user data.
export class SqlLogger implements DrizzleLogger {
  logQuery(query: string, params: unknown[]) {
    dbLog.debug({ params: params.length }, query);
  }
}
