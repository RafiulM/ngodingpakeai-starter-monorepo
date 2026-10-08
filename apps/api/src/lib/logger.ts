import pino, { type DestinationStream, type Level } from "pino";
import { env } from "../config/env";
import pkg from "../../package.json" with { type: "json" };
import { getRequestContext } from "./request-context";

type LoggerOptions = {
  level?: Level | "silent";
  // A custom stream (tests capture output this way). Disables pretty printing.
  destination?: DestinationStream;
};

// One structured logger for the whole API.
// - Production: one JSON object per line on stdout, ready for any collector.
// - Development: pino-pretty, colorized and single-line.
// - Tests: silent unless LOG_LEVEL says otherwise.
export function createLogger({
  level = env.logLevel,
  destination,
}: LoggerOptions = {}) {
  const pretty = !destination && !env.isProduction && !env.isTest;
  return pino(
    {
      level,
      base: { service: "api", env: env.NODE_ENV, version: pkg.version },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Request correlation without threading `req` through services.
      mixin() {
        const context = getRequestContext();
        if (!context) return {};
        return context.userId
          ? { reqId: context.reqId, userId: context.userId }
          : { reqId: context.reqId };
      },
      redact: {
        paths: [
          "req.headers.cookie",
          "req.headers.authorization",
          'res.headers["set-cookie"]',
          "*.password",
          "*.newPassword",
          "*.currentPassword",
          "*.token",
          "*.secret",
        ],
        censor: "[redacted]",
      },
      ...(pretty
        ? {
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                singleLine: true,
                translateTime: "SYS:HH:MM:ss.l",
                // The access-log message already says "GET /path 200 12ms".
                ignore: "pid,hostname,service,env,version,req,res,responseTime",
              },
            },
          }
        : {}),
    },
    destination,
  );
}

export const logger = createLogger();

export type Logger = ReturnType<typeof createLogger>;
