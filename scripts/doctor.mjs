import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Pool } from "pg";
import {
  assertNode,
  assertPnpm,
  DEFAULT_API_URL,
  DEFAULT_WEB_URL,
  loadEnvironment,
  root,
} from "./lib.mjs";
import { databaseUrl, databaseError } from "./postgres.mjs";

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (error) {
    failures++;
    console.error(`✗ ${label}: ${error.message}`);
  }
}

function origin(name, fallback) {
  const url = new URL(process.env[name] || fallback);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(`${name} must be an origin such as ${fallback}.`);
  return url;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

await loadEnvironment();
await check("Node.js", assertNode);
await check("pnpm", assertPnpm);
await check("Auth secret", () => {
  if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32)
    throw new Error(
      "Run pnpm run setup or set BETTER_AUTH_SECRET to 32+ characters.",
    );
});
await check("API and web origins", () => {
  const api = origin("BETTER_AUTH_URL", DEFAULT_API_URL);
  const web = origin("WEB_URL", DEFAULT_WEB_URL);
  const browserApi = origin("VITE_API_URL", api.href);
  if (browserApi.origin !== api.origin)
    throw new Error(
      `VITE_API_URL (${browserApi.origin}) must equal BETTER_AUTH_URL (${api.origin}): the browser calls the API there.`,
    );
  if (api.origin === web.origin)
    throw new Error("BETTER_AUTH_URL and WEB_URL must be different origins.");
});
await check("Session cookie reaches the web server", () => {
  const api = new URL(process.env.BETTER_AUTH_URL || DEFAULT_API_URL);
  const web = new URL(process.env.WEB_URL || DEFAULT_WEB_URL);
  if (LOCAL_HOSTS.has(api.hostname) || LOCAL_HOSTS.has(web.hostname)) {
    // Cookies ignore ports, but localhost and 127.0.0.1 are different hosts.
    if (api.hostname !== web.hostname)
      throw new Error(
        `Use the same host for both apps (${api.hostname} vs ${web.hostname}); cookies are per host.`,
      );
    return;
  }
  const domain = process.env.COOKIE_DOMAIN?.replace(/^\./, "");
  const covers = (host) => host === domain || host.endsWith(`.${domain}`);
  if (!domain || !covers(api.hostname) || !covers(web.hostname))
    throw new Error(
      `Set COOKIE_DOMAIN to a parent domain of both ${api.hostname} and ${web.hostname} (e.g. .example.com) so SSR can read the session.`,
    );
});
await check("PostgreSQL connection and tables", async () => {
  const pool = new Pool({
    connectionString: databaseUrl(),
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", () => {});
  try {
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
      [["user", "session", "account", "verification", "notes"]],
    );
    if (result.rowCount !== 5) throw new Error("MISSING_TABLES");
  } catch (error) {
    if (error.message === "MISSING_TABLES")
      throw new Error("Run pnpm db:migrate to create the tables.");
    throw new Error(databaseError(error));
  } finally {
    await pool.end();
  }
});
await check("Project instructions and skills", () => {
  for (const path of [
    "AGENTS.md",
    "agent.md",
    "compose.dev.yaml",
    ".agents/skills/dev-database/SKILL.md",
    ".agents/skills/build-feature/SKILL.md",
    ".agents/skills/create-variant/SKILL.md",
    ".agents/skills/starter-setup/SKILL.md",
  ]) {
    if (!existsSync(resolve(root, path))) throw new Error(`Missing ${path}`);
  }
});
await check("Context7 configuration files", () => {
  for (const path of [
    ".mcp.json",
    ".cursor/mcp.json",
    ".vscode/mcp.json",
    ".codex/config.toml",
  ]) {
    if (!existsSync(resolve(root, path))) throw new Error(`Missing ${path}`);
  }
});

// A reminder, not a failure: fresh copies must pass, but a finished app should
// not ship the starter's blank canvas. build-feature removes it with the app's
// first real screen.
function placeholders(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...placeholders(path));
    else if (
      /\.(tsx|jsx)$/.test(entry.name) &&
      readFileSync(path, "utf8").includes("data-starter-placeholder")
    )
      found.push(relative(root, path));
  }
  return found;
}
const remaining = placeholders(resolve(root, "apps/web/src"));
if (remaining.length)
  console.warn(
    `! Starter placeholder still present: ${remaining.join(", ")}. Replace it with your app's first screen (build-feature skill), then delete e2e/starter.spec.ts.`,
  );
console.log(
  "\nContext7 is checked inside your AI editor; this command checks local configuration and PostgreSQL only.",
);
process.exitCode = failures ? 1 : 0;
