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
  "/demo",
  "/demo/finance/income/invoices",
  "/demo/finance/income/customers",
  "/demo/finance/expense/list",
  "/demo/finance/expense/incoming-invoices",
  "/demo/finance/purchasing/orders",
  "/demo/finance/purchasing/suppliers",
  "/demo/finance/cash/accounts",
  "/demo/finance/inventory/products",
  "/demo/finance/inventory/history",
  "/demo/crm/customers",
  "/demo/sales/quotes",
  "/demo/sales/orders",
  "/demo/sales/activities",
  "/demo/reports/collections",
  "/demo/reports/income-expense",
  "/demo/reports/cash-bank",
  "/demo/reports/production",
];

describe("isolated golden Ebru demo route", () => {
  it("registers /demo before the canonical /apps wildcard", () => {
    expect(appSource.indexOf('path="/demo/*"')).toBeGreaterThan(-1);
    expect(appSource.indexOf('path="/demo/*"')).toBeLessThan(appSource.indexOf('path="/apps/*"'));
  });

  it("uses the existing ProtectedRoute wrapper", () => {
    expect(appSource).toContain('path="/demo/*" element={protectedElement(<EbruDemoPage />)}');
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
