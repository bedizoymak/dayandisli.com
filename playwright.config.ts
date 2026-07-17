import { defineConfig, devices } from "@playwright/test";

// E2E foundation for the ERP app. Authenticated Paraşüt-module flows are not
// runnable in CI/agent environments without real admin credentials (no
// magic-link/session bypass is used to obtain one — see
// PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md). Set E2E_ERP_EMAIL/
// E2E_ERP_PASSWORD locally to run the authenticated spec; it self-skips
// otherwise so the unauthenticated route-guard suite always runs.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
