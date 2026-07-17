import { describe, expect, it } from "vitest";
import { getUserPermissions, hasPermission } from "../shared/permissions";
import type { ERPUser } from "../shared/types";

function erpUser(overrides: Partial<ERPUser> = {}): ERPUser {
  return {
    id: "u1",
    auth_user_id: "au1",
    email: "user@example.com",
    full_name: "Test User",
    role: "viewer",
    roles: [],
    permissions: [],
    department: null,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("finance role and parasut permission consistency (frontend)", () => {
  it("grants the finance role parasut.view", () => {
    const user = erpUser({ role: "finance" });
    expect(getUserPermissions(user)).toContain("parasut.view");
    expect(hasPermission(user, "parasut.view")).toBe(true);
  });

  it("does NOT grant the finance role parasut.sync.view — this was the frontend/backend mismatch bug", () => {
    const user = erpUser({ role: "finance" });
    expect(getUserPermissions(user)).not.toContain("parasut.sync.view");
    expect(hasPermission(user, "parasut.sync.view")).toBe(false);
  });

  it("grants parasut.sync.view via an explicit per-user permission grant, without needing the finance role change", () => {
    const user = erpUser({ role: "finance", permissions: ["parasut.sync.view"] });
    expect(hasPermission(user, "parasut.sync.view")).toBe(true);
  });

  it("grants admin both parasut.view and parasut.sync.view via the existing admin bypass", () => {
    const user = erpUser({ role: "admin" });
    expect(hasPermission(user, "parasut.view")).toBe(true);
    expect(hasPermission(user, "parasut.sync.view")).toBe(true);
  });

  it("denies parasut.sync.view to a plain viewer with no explicit grant", () => {
    const user = erpUser({ role: "viewer" });
    expect(hasPermission(user, "parasut.sync.view")).toBe(false);
  });

  it("denies parasut.view entirely to a role with no financial or explicit access", () => {
    const user = erpUser({ role: "hr" });
    expect(hasPermission(user, "parasut.view")).toBe(false);
  });
});

describe("bidirectional write permissions (accounting.contacts.create / accounting.outbound.view)", () => {
  it("does NOT grant the finance role either permission, despite finance's general accounting.* wildcard — Phase 007 §8.8's explicit safest-default rule", () => {
    const user = erpUser({ role: "finance" });
    expect(hasPermission(user, "accounting.contacts.create")).toBe(false);
    expect(hasPermission(user, "accounting.outbound.view")).toBe(false);
    expect(getUserPermissions(user)).not.toContain("accounting.contacts.create");
    expect(getUserPermissions(user)).not.toContain("accounting.outbound.view");
  });

  it("grants both to admin via the existing admin bypass", () => {
    const user = erpUser({ role: "admin" });
    expect(hasPermission(user, "accounting.contacts.create")).toBe(true);
    expect(hasPermission(user, "accounting.outbound.view")).toBe(true);
  });

  it("grants accounting.contacts.create via an explicit per-user permission grant, without needing any role change", () => {
    const user = erpUser({ role: "finance", permissions: ["accounting.contacts.create"] });
    expect(hasPermission(user, "accounting.contacts.create")).toBe(true);
    // The explicit grant does not also imply the view permission.
    expect(hasPermission(user, "accounting.outbound.view")).toBe(false);
  });

  it("denies both to every other role with no explicit grant", () => {
    for (const role of ["sales", "operator", "purchasing", "warehouse", "hr", "quality", "viewer"] as const) {
      const user = erpUser({ role });
      expect(hasPermission(user, "accounting.contacts.create")).toBe(false);
    }
  });
});
