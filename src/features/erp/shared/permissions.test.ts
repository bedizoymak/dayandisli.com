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
});
