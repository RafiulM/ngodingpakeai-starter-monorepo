// Grants a role to an existing account: pnpm role:set <email> <role>
// Roles are only meaningful if they exist in @starter/shared/permissions.
// Signup never sets a role, so promoting the first admin happens here.
import "./load-env";
import { Pool } from "pg";
import { roles } from "@starter/shared/permissions";
import { databaseError, databaseUrl } from "./db/connection";

// pnpm forwards a literal "--" when called as `pnpm role:set -- <email> <role>`.
const [email, role] = process.argv.slice(2).filter((arg) => arg !== "--");
if (!email || role === undefined) {
  console.error(
    "Usage: pnpm role:set <email> <role>\n" +
      "Use a comma-separated list to grant several roles, e.g. admin,support.\n" +
      'Pass "" to clear the role and fall back to the default.',
  );
  process.exit(1);
}
if (!/^[a-z0-9_,-]*$/i.test(role)) {
  console.error("A role name may contain letters, digits, _, - and commas.");
  process.exit(1);
}

// Catch a typo before it silently grants nothing.
const unknown = role
  .split(",")
  .map((name) => name.trim())
  .filter((name) => name && !Object.hasOwn(roles, name));
if (unknown.length)
  console.warn(
    `Warning: ${unknown.join(", ")} is not declared in packages/shared/src/permissions.ts and grants nothing.`,
  );

let pool: Pool | undefined;
try {
  pool = new Pool({
    connectionString: databaseUrl(),
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", () => {});
  const { rows } = await pool.query(
    'UPDATE "user" SET role = $1, updated_at = now() WHERE lower(email) = lower($2) RETURNING email, role',
    [role || null, email],
  );
  if (!rows.length) {
    console.error(`No account found for ${email}. Sign up first, then retry.`);
    process.exitCode = 1;
  } else {
    console.log(
      `${rows[0].email} now has role: ${rows[0].role ?? "(default)"}`,
    );
    console.log("Reload the web app to pick up the new access.");
  }
} catch (error) {
  console.error(databaseError(error));
  process.exitCode = 1;
} finally {
  await pool?.end();
}
