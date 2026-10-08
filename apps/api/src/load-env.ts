import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Import first in every entrypoint (server, migrate, set-role). Reads the
// repository root's .env.local, then .env. Values already in the process
// environment always win, so a supplied DATABASE_URL is never overridden.
// apps/api/src (tsx) and apps/api/dist (build) sit at the same depth;
// in a container neither file exists and the real environment is used as is.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

for (const name of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(resolve(root, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
