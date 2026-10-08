import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { assertNode, assertPnpm, root, runPnpm } from "./lib.mjs";

try {
  assertNode();
  assertPnpm();
  console.log("\nSetting up your starter…\n");
  runPnpm(
    existsSync(resolve(root, "pnpm-lock.yaml"))
      ? ["install", "--frozen-lockfile"]
      : ["install"],
  );
  runPnpm(["run", "dev:prepare"]);
  runPnpm(["run", "doctor"]);
  console.log(
    "\nReady. Run pnpm dev: the API starts on BETTER_AUTH_URL (default http://localhost:4000) and the web app on WEB_URL (default http://localhost:3000).\n",
  );
} catch (error) {
  console.error(`\nSetup stopped: ${error.message}`);
  process.exitCode = 1;
}
