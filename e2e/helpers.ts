import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { expect, type APIRequestContext } from "@playwright/test";
import { API_URL, WEB_URL } from "../playwright.config";

export { API_URL, WEB_URL };

// Cookie-authenticated mutations must come from the web app's origin.
export const headers = { Origin: WEB_URL };
export const PASSWORD = "A-long-test-password-123!";

// Signs up through the API. The cookie it sets for localhost also reaches the
// web app (cookies ignore ports), exactly as in a browser.
export async function signUp(client: APIRequestContext, name = "Test User") {
  const data = {
    name,
    email: `e2e-${randomUUID()}@example.com`,
    password: PASSWORD,
  };
  let response = await client.post(`${API_URL}/api/auth/sign-up/email`, {
    headers,
    data,
  });
  if (response.status() === 429) {
    // The production auth server limits rapid signups. Honor its retry window once.
    const seconds = Number(response.headers()["retry-after"] || 10);
    await delay((Math.min(seconds, 10) + 0.1) * 1000);
    response = await client.post(`${API_URL}/api/auth/sign-up/email`, {
      headers,
      data,
    });
  }
  expect(response.status()).toBe(200);
  return data.email;
}

// Roles are granted out of band, the way pnpm role:set does it.
export async function setRole(email: string, role: string | null) {
  const pool = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rowCount } = await pool.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [role, email],
    );
    expect(rowCount).toBe(1);
  } finally {
    await pool.end();
  }
}

export async function fitsWidth(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
}
