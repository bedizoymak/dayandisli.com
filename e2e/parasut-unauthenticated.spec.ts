import { test, expect } from "@playwright/test";

// Runs without any credentials — verifies the route guard, not the module UI.
test.describe("Paraşüt module — unauthenticated route guard", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("visiting /apps/parasut while unauthenticated redirects to /login", async ({ page }) => {
    await page.goto("/apps/parasut");
    await expect(page).toHaveURL(/\/login/);
  });

  test("visiting a deep Paraşüt route while unauthenticated redirects to /login", async ({ page }) => {
    await page.goto("/apps/parasut/senkronizasyon");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the sync-run detail route also redirects when unauthenticated", async ({ page }) => {
    await page.goto("/apps/parasut/senkronizasyon/some-run-id");
    await expect(page).toHaveURL(/\/login/);
  });
});
