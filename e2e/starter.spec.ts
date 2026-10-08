import { expect, test } from "@playwright/test";
import { fitsWidth, signUp } from "./helpers";

// Covers the starter's blank canvas only. Delete this file together with the
// placeholder in the signed-in app page once your first screen replaces it.
test("the placeholder app page greets the account and its prompt can be copied", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Sign up through the API: the form is covered by auth.spec.ts.
  const email = await signUp(page.request, "Ada Builder");
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "Welcome, Ada Builder." }),
  ).toBeVisible();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.locator("[data-starter-placeholder]")).toBeVisible();
  await page.getByRole("button", { name: "Copy prompt" }).click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Read AGENTS.md",
  );
  expect(await fitsWidth(page)).toBe(true);
});
