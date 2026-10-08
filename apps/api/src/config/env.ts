import { z } from "zod";

// Environment values are loaded by Node (`--env-file-if-exists` in the package
// scripts) from the repository root's .env.local and .env. Values already in the
// process environment win, so a supplied DATABASE_URL is never overridden.

const origin = (message: string) =>
  z.url().refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  }, message);

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // Defaults to BETTER_AUTH_URL's port (4000 when it has none).
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.url().refine((value) => {
    const url = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      Boolean(url.hostname) &&
      url.pathname.length > 1 &&
      !url.hash
    );
  }, "Set DATABASE_URL to a PostgreSQL connection string or run pnpm run setup."),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "Run pnpm run setup to generate a secret."),
  BETTER_AUTH_URL: origin(
    "Use the API's origin, e.g. http://localhost:4000.",
  ).default("http://localhost:4000"),
  WEB_URL: origin(
    "Use the web app's origin, e.g. http://localhost:3000.",
  ).default("http://localhost:3000"),
  TRUSTED_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(origin("TRUSTED_ORIGINS must be comma-separated origins."))),
  COOKIE_DOMAIN: z
    .string()
    .regex(/^\.?[a-z0-9.-]+$/i, "Use a parent domain such as .example.com.")
    .optional(),
  // A hop count or subnet list. `true` would trust any X-Forwarded-For a
  // client sends, letting it pick the IP that rate limits are counted by.
  TRUST_PROXY: z
    .string()
    .refine(
      (value) => value !== "true",
      "Use a hop count (e.g. 1) or a subnet list such as loopback; true trusts any client-supplied X-Forwarded-For.",
    )
    .optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .optional(),
  LOG_SQL: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Field names and messages only: never print the values themselves.
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`Invalid API environment:\n${problems}`);
  process.exit(1);
}

const values = parsed.data;

export const env = {
  ...values,
  PORT: values.PORT ?? (Number(new URL(values.BETTER_AUTH_URL).port) || 4000),
  isProduction: values.NODE_ENV === "production",
  isTest: values.NODE_ENV === "test",
  // Browser origins allowed to call the API with cookies.
  trustedOrigins: [
    ...new Set([
      new URL(values.WEB_URL).origin,
      ...values.TRUSTED_ORIGINS.map((value) => new URL(value).origin),
    ]),
  ],
  logLevel:
    values.LOG_LEVEL ??
    (values.NODE_ENV === "production"
      ? "info"
      : values.NODE_ENV === "test"
        ? "silent"
        : "debug"),
};

// Express "trust proxy": off, a hop count, or a list of subnets.
export function trustProxySetting(value = env.TRUST_PROXY) {
  if (value === undefined || value === "" || value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
