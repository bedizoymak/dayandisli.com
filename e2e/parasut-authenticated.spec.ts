import { test, expect } from "@playwright/test";

// Requires a real admin ERP session. Never generated via service-role/magic-link —
// only a real login form submission with credentials the operator supplies out of
// band. Set E2E_ERP_EMAIL/E2E_ERP_PASSWORD locally or in CI secrets to run this
// suite; it self-skips (not fails) when they're absent, so CI/agent runs without
// credentials still pass.
const email = process.env.E2E_ERP_EMAIL;
const password = process.env.E2E_ERP_PASSWORD;

test.describe("Paraşüt module — authenticated smoke test", () => {
  test.skip(!email || !password, "E2E_ERP_EMAIL / E2E_ERP_PASSWORD not set — authenticated smoke test skipped.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-posta|email/i).fill(email!);
    await page.getByLabel(/şifre|parola|password/i).fill(password!);
    await page.getByRole("button", { name: /giriş|login|sign in/i }).click();
    await expect(page).toHaveURL(/\/apps|\/dashboard/);
  });

  const routes = [
    "/apps",
    "/apps/parasut",
    "/apps/parasut/kasa-banka",
    "/apps/parasut/satislar/musteriler",
    "/apps/parasut/alislar/tedarikciler",
    "/apps/parasut/urunler",
    "/apps/parasut/satislar/faturalar",
    "/apps/parasut/alislar/faturalar",
    "/apps/parasut/tahsilatlar",
    "/apps/parasut/odemeler",
    "/apps/parasut/raporlar/satis",
    "/apps/parasut/raporlar/tahsilat",
    "/apps/parasut/raporlar/alis",
    "/apps/parasut/raporlar/odeme",
    "/apps/parasut/raporlar/gelir-gider",
    "/apps/parasut/senkronizasyon",
  ];

  for (const route of routes) {
    test(`${route} loads without console errors, 401/403/404/500, or a stuck loading state`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("response", (response) => {
        if ([401, 403, 404, 500].includes(response.status())) failedRequests.push(`${response.status()} ${response.url()}`);
      });

      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("status")).toHaveCount(0, { timeout: 10_000 });

      expect(failedRequests, `Unexpected HTTP failures on ${route}`).toEqual([]);
      expect(consoleErrors, `Console errors on ${route}`).toEqual([]);
    });
  }

  test("sales invoice list -> detail -> back navigation works", async ({ page }) => {
    await page.goto("/apps/parasut/satislar/faturalar");
    await page.waitForLoadState("networkidle");
    const firstRow = page.locator("table tbody tr").first();
    await firstRow.click();
    await expect(page).toHaveURL(/\/satislar\/faturalar\/.+/);
    await page.goBack();
    await expect(page).toHaveURL(/\/satislar\/faturalar$/);
  });

  test("purchase bill list -> detail -> back navigation works", async ({ page }) => {
    await page.goto("/apps/parasut/alislar/faturalar");
    await page.waitForLoadState("networkidle");
    const firstRow = page.locator("table tbody tr").first();
    await firstRow.click();
    await expect(page).toHaveURL(/\/alislar\/faturalar\/.+/);
    await page.goBack();
    await expect(page).toHaveURL(/\/alislar\/faturalar$/);
  });

  test("sync page -> sync-run detail -> back navigation works", async ({ page }) => {
    await page.goto("/apps/parasut/senkronizasyon");
    await page.waitForLoadState("networkidle");
    const firstRow = page.locator("table tbody tr").first();
    await firstRow.click();
    await expect(page).toHaveURL(/\/senkronizasyon\/.+/);
    await page.goBack();
    await expect(page).toHaveURL(/\/senkronizasyon$/);
  });

  test("mobile viewport does not break the Paraşüt dashboard layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/apps/parasut");
    await page.waitForLoadState("networkidle");
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);
  });
});
