import { defineConfig } from "tsup";

// Bundles the server and the migrator into self-contained ESM files, including
// @starter/shared (TypeScript source) and npm dependencies, so the production
// image ships only dist/ and drizzle/ — no node_modules.
export default defineConfig({
  entry: { server: "src/server.ts", migrate: "src/migrate.ts" },
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: true,
  noExternal: [/.*/],
  // Optional native bindings and dev-only transports are never loaded in production.
  external: ["pg-native", "pino-pretty"],
  // Some CommonJS dependencies call require() at runtime.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
