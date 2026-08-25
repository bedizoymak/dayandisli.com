import { describe, expect, it } from "vitest";
import { getRequiredPermissionForPath } from "./permissions";

/**
 * PHASE 11: the old version of this test cross-checked against
 * config/erpModules.ts — a legacy nav registry advertising routes that do
 * not exist (/teklifler, /kargo, /calculator…), which was deleted together
 * with the admin suite that consumed it. The invariant worth keeping is that
 * every LIVE shell route family resolves to its documented permission; these
 * are curated against src/App.tsx's route table and shellNavigationData.
 */
describe("ERP permission contracts", () => {
  const CONTRACT: Array<[string, string | null]> = [
    ["/apps", "dashboard.view"],
    ["/apps/finance", "finance.view"],
    ["/apps/finance/income/invoices", "finance.view"],
    ["/apps/crm/customers", "crm.view"],
    ["/apps/sales/quotes", "sales.view"],
    ["/apps/reports/collections", "reports.view"],
  ];

  it.each(CONTRACT)("resolves %s to %s", (path, permission) => {
    expect(getRequiredPermissionForPath(path)).toBe(permission);
  });

  it("never grants finance screens to an unrelated permission", () => {
    expect(getRequiredPermissionForPath("/apps/finance/income/invoices")).not.toBe("crm.view");
  });
});
