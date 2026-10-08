import { createRequire } from "node:module";
import pino from "pino";
import { getRequestContext } from "@/lib/request-context.server";

const production = process.env.NODE_ENV === "production";

// The web server's structured logger: JSON lines in production, pino-pretty in
// development. Every line written during a request carries its reqId — the
// same one forwarded to the API — so one ID traces an SSR render end to end.
export const logger = pino({
  level: process.env.LOG_LEVEL || (production ? "info" : "debug"),
  base: { service: "web", env: process.env.NODE_ENV ?? "development" },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin() {
    const context = getRequestContext();
    return context ? { reqId: context.reqId } : {};
  },
  redact: {
    paths: ["*.cookie", "*.authorization", '*["set-cookie"]'],
    censor: "[redacted]",
  },
  ...(production
    ? {}
    : {
        transport: {
          // Absolute path: under pnpm, pino itself cannot see this package's
          // devDependency, and Vite's SSR runner hides the calling file.
          target: createRequire(import.meta.url).resolve("pino-pretty"),
          options: {
            colorize: true,
            singleLine: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname,service,env",
            messageFormat: "[web] {msg}",
          },
        },
      }),
});
