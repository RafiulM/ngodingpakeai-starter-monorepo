import { expect, test } from "@playwright/test";
import { API_URL, headers, signUp } from "./helpers";

// The HTTP contract is covered in depth by the API suite (apps/api/src/test).
// These tests drive the real browser path: React hooks → API on another
// origin → PostgreSQL, plus server rendering with the forwarded cookie.

test("the Notes page creates, edits, and deletes through the hooks, and SSR renders saved notes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signUp(page.request, "Note Taker");

  await page.goto("/notes");
  await expect(
    page.getByText("No notes yet. Add your first one above."),
  ).toBeVisible();

  const newNote = page.getByRole("region", { name: "New note" });
  await newNote.getByLabel("Title").fill("Buy oat milk");
  await newNote.getByLabel("Details").fill("The barista kind");
  await newNote.getByRole("button", { name: "Add note" }).click();
  const item = page.getByTestId("note").filter({ hasText: "Buy oat milk" });
  await expect(item).toBeVisible();
  await expect(item).toContainText("The barista kind");
  await expect(newNote.getByLabel("Title")).toHaveValue("");

  await item.getByRole("button", { name: "Edit Buy oat milk" }).click();
  const editTitle = page.locator('input[id^="edit-"][id$="-title"]');
  await editTitle.fill("Buy oat milk ×2");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByTestId("note").filter({ hasText: "Buy oat milk ×2" }),
  ).toBeVisible();

  // Server-rendered HTML already contains the note (SSR prefetch via the
  // web server, which forwarded this browser's cookie to the API).
  const html = await (await page.request.get("/notes")).text();
  expect(html).toContain("Buy oat milk ×2");

  await page.reload();
  const edited = page
    .getByTestId("note")
    .filter({ hasText: "Buy oat milk ×2" });
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: "Delete Buy oat milk ×2" }).click();
  await expect(
    page.getByText("No notes yet. Add your first one above."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("note")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("validation errors from the API surface in the form", async ({ page }) => {
  await signUp(page.request, "Validator");
  await page.goto("/notes");
  const newNote = page.getByRole("region", { name: "New note" });
  // Bypass the browser's maxlength to reach the API's own validation.
  await newNote.getByLabel("Title").evaluate((input: HTMLInputElement) => {
    input.removeAttribute("maxlength");
  });
  await newNote.getByLabel("Title").fill("x".repeat(161));
  await newNote.getByRole("button", { name: "Add note" }).click();
  await expect(newNote.getByRole("alert")).toContainText("title");
});

test("one account never sees another account's notes", async ({
  page,
  browser,
}) => {
  await signUp(page.request, "Owner");
  const created = await page.request.post(`${API_URL}/api/notes`, {
    headers,
    data: { title: "Private plans" },
  });
  expect(created.status()).toBe(201);

  const strangerContext = await browser.newContext();
  const stranger = await strangerContext.newPage();
  await signUp(stranger.request, "Stranger");
  await stranger.goto("/notes");
  await expect(
    stranger.getByText("No notes yet. Add your first one above."),
  ).toBeVisible();
  await expect(stranger.getByText("Private plans")).toHaveCount(0);
  await strangerContext.close();
});
