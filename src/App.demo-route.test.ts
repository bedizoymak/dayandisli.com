import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.tsx", "utf8");
const demoRoot = "src/features/ebru-demo";

function featureSource(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? [featureSource(path)] : /\.(?:ts|tsx|css)$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
    })
    .join("\n");
}

const demoSource = featureSource(demoRoot);

const requiredRoutes = [
  "/apps/demo",
  "/apps/demo/finance/income/invoices",
  "/apps/demo/finance/income/customers",
  "/apps/demo/finance/expense/list",
  "/apps/demo/finance/expense/incoming-invoices",
  "/apps/demo/finance/purchasing/orders",
  "/apps/demo/finance/purchasing/suppliers",
  "/apps/demo/finance/cash/accounts",
  "/apps/demo/finance/inventory/products",
  "/apps/demo/finance/inventory/history",
  "/apps/demo/crm/customers",
  "/apps/demo/sales/quotes",
  "/apps/demo/sales/orders",
  "/apps/demo/sales/activities",
  "/apps/demo/reports/collections",
  "/apps/demo/reports/income-expense",
  "/apps/demo/reports/cash-bank",
  "/apps/demo/reports/production",
];

describe("isolated golden Ebru demo route", () => {
  it("registers /apps/demo before the canonical /apps wildcard", () => {
    expect(appSource.indexOf('path="/apps/demo/*"')).toBeGreaterThan(-1);
    expect(appSource.indexOf('path="/apps/demo/*"')).toBeLessThan(appSource.indexOf('path="/apps/*"'));
  });

  it("uses the existing ProtectedRoute wrapper", () => {
    expect(appSource).toContain('path="/apps/demo/*" element={protectedElement(<EbruDemoPage />)}');
  });

  it("loads the isolated snapshot implementation without changing the canonical route", () => {
    expect(appSource).toContain('import("./features/ebru-demo/EbruPreviewPage")');
    expect(appSource).toContain('path="/apps/*" element={protectedElement(<EbruPreviewPage />)}');
  });

  it.each(requiredRoutes)("keeps the original preview module reachable at %s", (route) => {
    expect(demoSource).toContain(route);
  });

  it("contains no stale snapshot route prefix", () => {
    expect(demoSource).not.toContain("/apps/ebru-preview");
  });

  it("does not import production data or authentication modules", () => {
    expect(demoSource).not.toMatch(/@\/features\/erp|@\/integrations\/supabase|@\/contexts\/ERPAuthContext|supabase|parasut/i);
  });
});
