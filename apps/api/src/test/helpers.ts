import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../app";

if (!process.env.STARTER_TEST_RUN?.startsWith("starter-pg-test-"))
  throw new Error(
    "Run pnpm test from the repository root so these tests get their own disposable PostgreSQL server.",
  );

export const WEB_ORIGIN = new URL(
  process.env.WEB_URL ?? "http://localhost:3101",
).origin;
export const originHeader = { Origin: WEB_ORIGIN };

// A supertest agent keeps cookies between requests, like a browser.
export function agent(app: Express = createApp()) {
  return request.agent(app);
}

export async function signUp(
  client: ReturnType<typeof agent>,
  name = "Test User",
) {
  const email = `test-${randomUUID()}@example.com`;
  const response = await client
    .post("/api/auth/sign-up/email")
    .set(originHeader)
    .send({ name, email, password: "Test-password-123!" });
  if (response.status !== 200)
    throw new Error(`Sign-up failed with ${response.status}`);
  return email;
}

// Roles are granted out of band, the way pnpm role:set does it.
export async function setRole(email: string, role: string | null) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const { rowCount } = await pool.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [role, email],
    );
    if (rowCount !== 1) throw new Error(`No user ${email}`);
  } finally {
    await pool.end();
  }
}
