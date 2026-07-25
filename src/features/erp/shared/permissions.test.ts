import { describe, expect, it } from "vitest";
import { erpModules, visibleErpModules } from "@/config/erpModules";
import { getRequiredPermissionForPath } from "./permissions";

describe("ERP permission contracts", () => {
  it.each(visibleErpModules.map((module) => [module.id, module.path, module.requiredPermission] as const))(
    "keeps the %s sidebar permission aligned with its route",
    (_id, route, permission) => {
      expect(getRequiredPermissionForPath(route)).toBe(permission);
    },
  );

  it.each([
    ["finance", "finance", "finance.view"],
    ["crm", "customers", "crm.view"],
    ["production", "calculator", "production.view"],
  ] as const)(
    "keeps %s sidebar and route permissions equal",
    (_domain, sidebarId, expectedPermission) => {
      const sidebar = erpModules.find((item) => item.id === sidebarId);

      expect(sidebar?.requiredPermission).toBe(expectedPermission);
      expect(getRequiredPermissionForPath(sidebar?.path ?? "")).toBe(expectedPermission);
    },
  );
});
