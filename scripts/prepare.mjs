import { assertNode, prepareEnvironment, runPnpm } from "./lib.mjs";

// Runs before `pnpm dev`: fills in missing local settings, starts the managed
// PostgreSQL container when this copy owns one, and applies migrations.
try {
  assertNode();
  await prepareEnvironment();
  runPnpm(["run", "db:up"]);
  runPnpm(["run", "db:migrate"]);
} catch (error) {
  console.error(`Setup needs attention: ${error.message}`);
  process.exitCode = 1;
}
