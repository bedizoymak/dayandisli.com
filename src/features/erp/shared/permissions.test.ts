import { describe, expect, it } from "vitest";
import { erpApplications } from "../apps/applicationRegistry";
import { erpModules, visibleErpModules } from "@/config/erpModules";
import { getRequiredPermissionForPath } from "./permissions";

describe("ERP permission contracts", () => {
  it.each(erpApplications.map((app) => [app.id, app.route, app.permissionKey] as const))(
    "keeps the %s application permission aligned with its route",
    (_id, route, permission) => {
      expect(getRequiredPermissionForPath(route)).toBe(permission);
    },
  );

  it.each(
    erpApplications.flatMap((app) =>
      app.modules.map((module) => [app.id, module.title, module.route, module.permissionKey] as const),
    ),
  )("keeps the %s / %s module permission aligned with its route", (_appId, _title, route, permission) => {
    expect(getRequiredPermissionForPath(route)).toBe(permission);
  });

  it.each(visibleErpModules.map((module) => [module.id, module.path, module.requiredPermission] as const))(
    "keeps the %s sidebar permission aligned with its route",
    (_id, route, permission) => {
      expect(getRequiredPermissionForPath(route)).toBe(permission);
    },
  );

  it.each([
    ["finance", "accounting", "finance", "finance.view"],
    ["crm", "crm", "customers", "crm.view"],
    ["production", "production", "calculator", "production.view"],
  ] as const)(
    "keeps %s application, sidebar, and route permissions equal",
    (_domain, applicationId, sidebarId, expectedPermission) => {
      const application = erpApplications.find((item) => item.id === applicationId);
      const sidebar = erpModules.find((item) => item.id === sidebarId);

      expect(application?.permissionKey).toBe(expectedPermission);
      expect(sidebar?.requiredPermission).toBe(expectedPermission);
      expect(getRequiredPermissionForPath(application?.route ?? "")).toBe(expectedPermission);
      expect(getRequiredPermissionForPath(sidebar?.path ?? "")).toBe(expectedPermission);
    },
  );

  // Real ERP pages now mount under the unified /apps/* shell (e.g. bare
  // "/finans" is reachable as "/apps/finans"). Every such nested route must
  // resolve to exactly the same permission as its pre-migration bare path —
  // never silently fall back to the permissive generic "/apps" -> dashboard.view.
  it.each([
    ["/apps/finans", "finance.view"],
    ["/apps/finans/hareketler/yeni", "finance.view"],
    ["/apps/musteriler", "crm.view"],
    ["/apps/tedarikciler", "crm.view"],
    ["/apps/teklifler", "sales.view"],
    ["/apps/siparisler", "sales.view"],
    ["/apps/quotations", "sales.view"],
    ["/apps/ayarlar", "settings.view"],
    ["/apps/work-orders", "production.view"],
    ["/apps/subcontracting", "production.view"],
    ["/apps/purchase-orders", "purchasing.view"],
    ["/apps/logistics", "production.view"],
    ["/apps/kargo", "inventory.view"],
    ["/apps/documents", "production.view"],
    ["/apps/health", "reports.view"],
    ["/apps/time-entries", "hr.view"],
  ] as const)("resolves the canonical nested route %s to %s, not the generic /apps fallback", (route, expectedPermission) => {
    expect(getRequiredPermissionForPath(route)).toBe(expectedPermission);
  });

  it("still resolves bare /apps and /apps/dashboard to the permissive generic permission, unchanged", () => {
    expect(getRequiredPermissionForPath("/apps")).toBe("dashboard.view");
    expect(getRequiredPermissionForPath("/apps/dashboard")).toBe("dashboard.view");
  });
});
