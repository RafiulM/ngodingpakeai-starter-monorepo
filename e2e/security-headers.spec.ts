import { expect, test } from "@playwright/test";

test("web pages carry the browser hardening headers", async ({ request }) => {
  const response = await request.get("/sign-in");
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  // The browser tests run the production build, which sends HSTS.
  expect(headers["strict-transport-security"]).toContain("max-age=");
});
