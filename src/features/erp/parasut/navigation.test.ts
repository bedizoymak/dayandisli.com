import { describe, expect, it } from "vitest";
import { erpApplications } from "../apps/applicationRegistry";
import { getRequiredPermissionForPath } from "../shared/permissions";
import { parasutNavigation, PARASUT_SYNC_PERMISSION } from "./navigation";
import { REPORT_TABS } from "./pages/ReportsPage";

describe("Paraşüt application card", () => {
  it("is the first card in the ERP applications registry", () => {
    expect(erpApplications[0]?.id).toBe("parasut");
    expect(erpApplications[0]?.title).toBe("Paraşüt");
    expect(erpApplications[0]?.description).toBe("Paraşüt finans, fatura, tahsilat ve gider verileri.");
  });

  it("keeps every other application's relative order unchanged after parasut", () => {
    const nonParasutIds = erpApplications.filter((app) => app.id !== "parasut").map((app) => app.id);
    expect(nonParasutIds).toEqual([
      "website",
      "commerce",
      "crm",
      "sales",
      "invoicing",
      "accounting",
      "expenses",
      "inventory",
      "purchasing",
      "production",
      "quality",
      "maintenance",
      "repair",
      "hr",
      "reports",
      "settings",
      "ebru-preview",
    ]);
  });

  it("never surfaces the ebru-preview registry entry as a production navigation item", () => {
    // The application-registry entry still exists for permission-path bookkeeping
    // (getRequiredPermissionForPath("/apps")), but the unified shell's
    // sidebar is built from src/config/erpModules.ts, which has no such entry —
    // so the retired launcher card can never resurface in production navigation.
    const previewModule = erpApplications.find((app) => app.id === "ebru-preview");
    expect(previewModule?.route).toBe("/apps");
  });

  it("routes to /apps/parasut and requires the parasut.view permission at the route level", () => {
    const app = erpApplications.find((item) => item.id === "parasut");
    expect(app?.route).toBe("/apps/parasut");
    expect(app?.permissionKey).toBe("parasut.view");
    expect(getRequiredPermissionForPath("/apps/parasut")).toBe("parasut.view");
  });

  it("blocks the sync sub-route behind a separate, stricter permission", () => {
    expect(getRequiredPermissionForPath("/apps/parasut/senkronizasyon")).toBe(PARASUT_SYNC_PERMISSION);
    expect(getRequiredPermissionForPath("/apps/parasut/sistem/isler")).toBe(PARASUT_SYNC_PERMISSION);
    expect(getRequiredPermissionForPath("/apps/parasut/senkronizasyon")).not.toBe("parasut.view");
  });
});

describe("Paraşüt module navigation", () => {
  it("marks newly confirmed sales and expense mirror resources as available", () => {
    const salesGroup = parasutNavigation.find((group) => group.id === "sales")!;
    const quotesItem = salesGroup.items.find((item) => item.id === "quotes")!;
    expect(quotesItem.available).toBe(true);

    const purchasingGroup = parasutNavigation.find((group) => group.id === "purchasing")!;
    const expensesItem = purchasingGroup.items.find((item) => item.id === "expenses")!;
    expect(expensesItem.available).toBe(true);
  });

  it("marks every confirmed-mirrored resource as available", () => {
    const salesGroup = parasutNavigation.find((group) => group.id === "sales")!;
    expect(salesGroup.items.find((item) => item.id === "sales-invoices")?.available).toBe(true);
    expect(salesGroup.items.find((item) => item.id === "customers")?.available).toBe(true);

    const purchasingGroup = parasutNavigation.find((group) => group.id === "purchasing")!;
    expect(purchasingGroup.items.find((item) => item.id === "purchase-bills")?.available).toBe(true);
    expect(purchasingGroup.items.find((item) => item.id === "suppliers")?.available).toBe(true);
  });

  it("requires the stricter sync permission only on integration-monitoring groups", () => {
    const syncGroup = parasutNavigation.find((group) => group.id === "sync")!;
    expect(syncGroup.requiredPermission).toBe(PARASUT_SYNC_PERMISSION);
    const jobsGroup = parasutNavigation.find((group) => group.id === "jobs")!;
    expect(jobsGroup.requiredPermission).toBe(PARASUT_SYNC_PERMISSION);
    const otherGroups = parasutNavigation.filter((group) => !["sync", "jobs"].includes(group.id));
    expect(otherGroups.every((group) => !group.requiredPermission)).toBe(true);
  });

  it("every raporlar/* nav route slug matches a real ReportsPage tab value, so clicking never silently falls back to the wrong tab", () => {
    const reportTabValues = new Set(REPORT_TABS.map((tab) => tab.value));
    const reportRoutes = parasutNavigation.flatMap((group) => group.items).map((item) => item.route).filter((route) => route.startsWith("raporlar/"));
    expect(reportRoutes.length).toBeGreaterThan(0);
    for (const route of reportRoutes) {
      const section = route.replace("raporlar/", "");
      expect(reportTabValues.has(section as never)).toBe(true);
    }
  });
});
