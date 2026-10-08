// Connection-string checks and friendly PostgreSQL errors for CLI entrypoints
// (migrate, set-role). Connection strings are never printed.

export function databaseUrl(value = process.env.DATABASE_URL) {
  try {
    const url = new URL(value ?? "");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2 ||
      url.hash
    )
      throw new Error();
    return value as string;
  } catch {
    throw new Error(
      "Set DATABASE_URL to a PostgreSQL connection string, or run pnpm run setup for a local database.",
    );
  }
}

export function databaseError(error: unknown) {
  const err = error as {
    code?: string;
    cause?: { code?: string };
    message?: string;
  };
  if (err.message?.startsWith("Set DATABASE_URL")) return err.message;
  const code = err.cause?.code || err.code;
  const explanations: Record<string, string> = {
    ECONNREFUSED:
      "PostgreSQL is not reachable. Start Docker and run pnpm db:up, or check your database host and port.",
    ENOTFOUND: "The PostgreSQL host could not be found. Check DATABASE_URL.",
    ETIMEDOUT:
      "The PostgreSQL connection timed out. Check network access and your database host.",
    "28P01":
      "PostgreSQL rejected the credentials. Check your private environment settings.",
    "3D000": "The configured PostgreSQL database does not exist.",
    "42501": "The PostgreSQL role lacks the required permissions.",
  };
  return (
    (code && explanations[code]) ||
    `PostgreSQL operation failed${code ? ` (${code})` : ""}. Check the connection, permissions, and migration SQL. Connection strings are not printed.`
  );
}
