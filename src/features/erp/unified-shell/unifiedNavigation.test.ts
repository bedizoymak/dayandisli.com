import { describe, expect, it } from "vitest";
import { buildUnifiedNavigation } from "./unifiedNavigation";

describe("unified ERP navigation grouping", () => {
  it("groups every permitted module under its Ebru-style section, in a stable order", () => {
    const groups = buildUnifiedNavigation(() => true);
    const groupIds = groups.map((group) => group.id);
    expect(groupIds).toEqual(["main", "commercial", "finance", "operations", "people", "system"]);
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
  });

  it("never includes the standalone Ebru preview route in production navigation", () => {
    const groups = buildUnifiedNavigation(() => true);
    const allPaths = groups.flatMap((group) => group.items.map((item) => item.path));
    expect(allPaths.some((path) => path.includes("ebru-preview"))).toBe(false);
  });

  it("filters items through the permission function and drops groups that end up empty", () => {
    const groups = buildUnifiedNavigation((permission) => permission === "dashboard.view");
    // Only the dashboard module requires exactly "dashboard.view"; every group
    // whose modules require something else must be dropped entirely.
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0);
    }
    const allPaths = groups.flatMap((group) => group.items.map((item) => item.path));
    expect(allPaths).toContain("/dashboard");
  });

  it("returns no groups at all when the user has no permissions", () => {
    const groups = buildUnifiedNavigation(() => false);
    expect(groups).toEqual([]);
  });

  it("has no duplicate module paths across all groups", () => {
    const groups = buildUnifiedNavigation(() => true);
    const allPaths = groups.flatMap((group) => group.items.map((item) => item.path));
    expect(new Set(allPaths).size).toBe(allPaths.length);
  });
});
