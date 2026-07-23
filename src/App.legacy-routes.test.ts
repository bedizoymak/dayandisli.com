import { describe, expect, it } from "vitest";
import { resolveLegacyParasutRoute } from "./App";

describe("legacy Paraşüt route redirects", () => {
  it.each([
    ["/apps/parasut", "/apps"],
    ["/apps/parasut/customers", "/apps/finance/income/customers"],
    ["/apps/parasut/sales-invoices", "/apps/finance/income/invoices"],
    ["/apps/parasut/purchase-bills", "/apps/finance/expense/incoming-invoices"],
    ["/apps/parasut/accounts", "/apps/finance/cash/accounts"],
    ["/apps/parasut/products", "/apps/finance/inventory/products"],
    ["/apps/parasut/employees", "/apps/hr/employees"],
  ])("maps %s to %s", (legacyPath, canonicalPath) => {
    expect(resolveLegacyParasutRoute(legacyPath)).toBe(canonicalPath);
  });
});
