import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { API_URL, headers, PASSWORD, setRole, signUp } from "./helpers";

test("admin endpoints answer 401 without a session and 403 for the default role", async ({
  request,
  browser,
}) => {
  for (const [method, url] of [
    ["GET", "/api/admin/notes"],
    ["DELETE", `/api/admin/notes/${randomUUID()}`],
  ]) {
    const response = await request.fetch(`${API_URL}${url}`, {
      method,
      headers,
    });
    expect(response.status()).toBe(401);
  }
  const context = await browser.newContext();
  await signUp(context.request, "Default Role");
  const response = await context.request.get(`${API_URL}/api/admin/notes`, {
    headers,
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("FORBIDDEN");
  await context.close();
});

test("the admin page renders only for a permitted role and can delete any note", async ({
  page,
  browser,
}) => {
  const ownerContext = await browser.newContext();
  await signUp(ownerContext.request, "Note Owner");
  const created = await ownerContext.request.post(`${API_URL}/api/notes`, {
    headers,
    data: { title: `Owned elsewhere ${randomUUID().slice(0, 8)}` },
  });
  const note = (await created.json()).data;

  const email = `roles-${randomUUID()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Page Viewer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.goto("/admin");
  await expect(page.getByText("Every account’s notes")).toHaveCount(0);

  await setRole(email, "admin");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Every account’s notes" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  await page.getByRole("button", { name: `Delete ${note.title}` }).click();
  await expect(page.getByText(note.title)).toHaveCount(0);
  expect(
    (
      await ownerContext.request.get(`${API_URL}/api/notes/${note.id}`)
    ).status(),
  ).toBe(404);

  // Revoking the role takes effect on the next request.
  await setRole(email, null);
  await page.goto("/admin");
  await expect(page.getByText("Every account’s notes")).toHaveCount(0);
  await ownerContext.close();
});
