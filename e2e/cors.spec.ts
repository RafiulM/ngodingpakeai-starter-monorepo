import { expect, test } from "@playwright/test";
import { API_URL, signUp } from "./helpers";

test("the web origin can call the API with cookies; other origins cannot read it", async ({
  page,
}) => {
  await signUp(page.request, "Cors Check");
  await page.goto("/app");
  const fromWebApp = await page.evaluate(async (api) => {
    const response = await fetch(`${api}/api/notes`, {
      credentials: "include",
    });
    return {
      status: response.status,
      requestId: response.headers.get("x-request-id"),
      body: await response.json(),
    };
  }, API_URL);
  expect(fromWebApp.status).toBe(200);
  expect(fromWebApp.requestId).toBeTruthy();
  expect(fromWebApp.body).toHaveProperty("data");

  // A page on any other origin: the browser blocks the cross-origin read.
  await page.route("http://untrusted.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>x</body></html>",
    }),
  );
  await page.goto("http://untrusted.test/");
  const fromElsewhere = await page.evaluate(async (api) => {
    try {
      await fetch(`${api}/api/notes`, { credentials: "include" });
      return "readable";
    } catch {
      return "blocked";
    }
  }, API_URL);
  expect(fromElsewhere).toBe("blocked");
});
